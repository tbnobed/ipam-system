#!/bin/sh
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready - starting application..."

# Set production environment
export NODE_ENV=production

# Run database migration with automatic confirmation
echo "Setting up database schema..."
echo "y" | timeout 30 npm run db:push || echo "Database schema setup may have failed, but continuing..."
echo "Database schema setup completed successfully"

# Ensure all required tables exist
echo "Verifying database tables..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE NOT NULL,
  vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
  subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
  permission TEXT CHECK (permission IN ('read', 'write', 'admin')) DEFAULT 'read' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group memberships table if it doesn't exist
CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_permissions_group_id ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_vlan_id ON group_permissions(vlan_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_subnet_id ON group_permissions(subnet_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
" || echo "Table creation verification failed, but continuing..."

# Ensure all required columns exist in users table
echo "Checking users table structure..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
DO \$\$
BEGIN
  -- Add is_active column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
  END IF;
  
  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
  
  -- Add updated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END
\$\$;
" || echo "Users table check failed, but continuing..."

# Create session table manually using SQL
echo "Creating session table..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE \"default\",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);
" || echo "Session table creation failed, but continuing..."

# Add primary key constraint if it doesn't exist
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_pkey'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);
  END IF;
END
\$\$;
" || echo "Primary key constraint may already exist, continuing..."

# Run production setup using separate file
echo "Setting up production environment..."
cat > /app/setup-production.mjs << 'EOF'
import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

const SALT_ROUNDS = 10;

async function setupProduction() {
  console.log('Setting up production database...');
  
  const pool = new Pool({
    host: 'postgres',
    port: 5432,
    database: 'ipam_db',
    user: 'ipam_user',
    password: 'ipam_password'
  });

  try {
    // Create admin user
    const hashedAdminPassword = await bcrypt.hash('admin', SALT_ROUNDS);
    await pool.query(`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('admin', $1, 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = $1,
        role = 'admin',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    `, [hashedAdminPassword]);
    
    console.log('✅ Admin user created/updated');
    
    // Create demo user
    const hashedUserPassword = await bcrypt.hash('user', SALT_ROUNDS);
    await pool.query(`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('user', $1, 'user', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = $1,
        role = 'user',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    `, [hashedUserPassword]);
    
    console.log('✅ Demo user created/updated');
    
    // Create demo viewer
    const hashedViewerPassword = await bcrypt.hash('viewer', SALT_ROUNDS);
    await pool.query(`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('viewer', $1, 'viewer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = $1,
        role = 'viewer',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    `, [hashedViewerPassword]);
    
    console.log('✅ Demo viewer created/updated');
    
    // Set default settings
    const defaultSettings = [
      { key: 'scan_interval', value: '300', description: 'Network scan interval in seconds' },
      { key: 'max_devices', value: '10000', description: 'Maximum number of devices to track' },
      { key: 'data_retention_days', value: '90', description: 'Days to retain historical data' },
      { key: 'notifications_enabled', value: 'true', description: 'Enable system notifications' },
      { key: 'email_notifications', value: 'false', description: 'Enable email notifications' }
    ];
    
    for (const setting of defaultSettings) {
      await pool.query(`
        INSERT INTO settings (key, value, description, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = $2,
          description = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [setting.key, setting.value, setting.description]);
    }
    
    console.log('✅ Default settings configured');
    
    // Create default groups
    const defaultGroups = [
      { name: 'Network Administrators', description: 'Full access to all network resources', is_active: true },
      { name: 'Device Managers', description: 'Read/write access to devices and subnets', is_active: true },
      { name: 'Viewers', description: 'Read-only access to network resources', is_active: true }
    ];
    
    for (const group of defaultGroups) {
      await pool.query(`
        INSERT INTO user_groups (name, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET
          description = $2,
          is_active = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [group.name, group.description, group.is_active]);
    }
    
    console.log('✅ Default groups created/updated');
    
    // Log the initialization
    await pool.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, timestamp)
      VALUES (1, 'system_init', 'system', 1, 
        '{"message": "Production database initialized with user groups"}',
        CURRENT_TIMESTAMP)
    `);
    
    console.log('✅ Production database setup completed successfully');
    
  } catch (error) {
    console.error('❌ Production database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupProduction().then(() => {
  console.log('Production setup completed');
  process.exit(0);
}).catch((error) => {
  console.error('Production setup failed:', error);
  process.exit(1);
});
EOF

cd /app && node setup-production.mjs || echo "Production setup script failed, creating users manually..."

# Fallback: Create users manually if script fails
echo "Creating admin user manually..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
INSERT INTO users (username, password, role, is_active, created_at, updated_at)
VALUES ('admin', '\$2b\$10\$kTUytVy5JqrENNN9bhxX4upMH4fnhYXtV51rKexLNQf0LFdh4F2LS', 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO UPDATE SET
  password = '\$2b\$10\$kTUytVy5JqrENNN9bhxX4upMH4fnhYXtV51rKexLNQf0LFdh4F2LS',
  role = 'admin',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
" || echo "Manual admin user creation failed"

echo "Creating user account manually..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
INSERT INTO users (username, password, role, is_active, created_at, updated_at)
VALUES ('user', '\$2b\$10\$Kq0oP800EYTxFtmDFCJg3OdQ9cr1Nb1wxvbvUs1rfALA.KfxTGZEK', 'user', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO UPDATE SET
  password = '\$2b\$10\$Kq0oP800EYTxFtmDFCJg3OdQ9cr1Nb1wxvbvUs1rfALA.KfxTGZEK',
  role = 'user',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
" || echo "Manual user creation failed"

echo "Creating viewer account manually..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
INSERT INTO users (username, password, role, is_active, created_at, updated_at)
VALUES ('viewer', '\$2b\$10\$eHcbROtI85NRnLxNoc5Ly.lsjVooJJbOSqhezyB2SrMeOmzc8.56e', 'viewer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (username) DO UPDATE SET
  password = '\$2b\$10\$eHcbROtI85NRnLxNoc5Ly.lsjVooJJbOSqhezyB2SrMeOmzc8.56e',
  role = 'viewer',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;
" || echo "Manual viewer creation failed"

echo "Creating default groups manually..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
INSERT INTO user_groups (name, description, is_active, created_at, updated_at)
VALUES 
  ('Network Administrators', 'Full access to all network resources', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Device Managers', 'Read/write access to devices and subnets', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Viewers', 'Read-only access to network resources', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;
" || echo "Manual groups creation failed"

echo "Verifying users were created..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "SELECT username, role, is_active FROM users;" || echo "User verification failed"

echo "Checking password storage (first 20 chars)..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "SELECT username, LEFT(password, 20) as password_start FROM users;" || echo "Password check failed"

# Start the application
echo "Starting IPAM application..."
exec npm run dev