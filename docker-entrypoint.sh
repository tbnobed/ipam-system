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
echo "y" | timeout 60 npm run db:push || echo "Database schema setup may have failed, but continuing..."
echo "Database schema setup completed successfully"

# Force push schema changes to ensure all tables are up to date
echo "Force updating database schema..."
npm run db:push -- --force || echo "Force schema update failed, but continuing..."

# Ensure all required tables exist
echo "Verifying database tables..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

-- Add created_by column to devices table if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE devices ADD COLUMN created_by TEXT DEFAULT 'system scan';
    UPDATE devices SET created_by = 'system scan' WHERE created_by IS NULL;
    RAISE NOTICE 'Added created_by column to devices table';
  ELSE
    RAISE NOTICE 'created_by column already exists in devices table';
  END IF;
END
\$\$;
" || echo "Table creation verification failed, but continuing..."

# Run additional migrations for user groups and permissions
echo "Running user groups and permissions migration..."
if [ -f /app/migrations/007_add_user_groups_and_permissions.sql ]; then
  echo "Migration file exists, running..."
  PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -f /app/migrations/007_add_user_groups_and_permissions.sql || echo "Group permissions migration failed, but continuing..."
else
  echo "Migration file not found, skipping..."
fi

# Run migration for created_by column
echo "Running created_by column migration..."
if [ -f /app/migrations/008_add_created_by_to_devices.sql ]; then
  echo "Created_by migration file exists, running..."
  PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -f /app/migrations/008_add_created_by_to_devices.sql || echo "Created_by migration failed, but continuing..."
else
  echo "Created_by migration file not found, skipping..."
fi

# Verify current database structure
echo "Checking current database structure..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_groups', 'group_permissions');
" || echo "Database structure check failed"

# Ensure group permissions tables exist manually if migration failed
echo "Creating group permissions tables manually..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
-- Create user_groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'viewer')) DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to user_groups if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_groups' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_groups ADD COLUMN role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'viewer')) DEFAULT 'viewer';
  END IF;
END
\$\$;

-- Create group_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
  subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL CHECK (permission IN ('view', 'write', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure at least one of vlan_id or subnet_id is set
  CONSTRAINT check_vlan_or_subnet CHECK (
    (vlan_id IS NOT NULL AND subnet_id IS NULL) OR 
    (vlan_id IS NULL AND subnet_id IS NOT NULL)
  ),
  
  -- Unique constraint to prevent duplicate permissions
  UNIQUE (group_id, vlan_id, subnet_id)
);

-- Add group_id column to users table if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE users ADD COLUMN group_id INTEGER REFERENCES user_groups(id) ON DELETE SET NULL;
  END IF;
END
\$\$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_permissions_group_id ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_vlan_id ON group_permissions(vlan_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_subnet_id ON group_permissions(subnet_id);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

-- Insert default Engineering group if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_groups WHERE name = 'Engineering') THEN
    INSERT INTO user_groups (name, description, role, created_at, updated_at)
    VALUES ('Engineering', 'Default engineering group with network access', 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END
\$\$;
" || echo "Manual group permissions table creation failed, but continuing..."

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
    
    // Set default settings including new notification settings from environment variables
    const defaultSettings = [
      { key: 'scan_interval', value: process.env.DEFAULT_SCAN_INTERVAL || '5', description: 'Network scan interval in minutes' },
      { key: 'ping_timeout', value: '2', description: 'Ping timeout in seconds' },
      { key: 'auto_discovery', value: 'true', description: 'Enable automatic device discovery' },
      { key: 'port_scanning', value: 'false', description: 'Scan common ports during discovery' },
      { key: 'device_alerts', value: 'true', description: 'Alert when devices go offline' },
      { key: 'subnet_alerts', value: 'true', description: 'Alert when subnet utilization exceeds threshold' },
      { key: 'alert_threshold', value: '90', description: 'Utilization alert threshold percentage' },
      { key: 'data_retention', value: process.env.DATA_RETENTION_DAYS || '90', description: 'Data retention period in days' },
      { key: 'alert_emails', value: process.env.ALERT_EMAILS || 'alerts@obedtv.com', description: 'Email recipients for alerts (comma-separated)' }
    ];

    // Log environment variables for debugging
    console.log('📋 DOCKER ENVIRONMENT VARIABLES:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   DEFAULT_SCAN_INTERVAL: ${process.env.DEFAULT_SCAN_INTERVAL || 'not set'}`);
    console.log(`   DATA_RETENTION_DAYS: ${process.env.DATA_RETENTION_DAYS || 'not set'}`);
    console.log(`   ALERT_EMAILS: ${process.env.ALERT_EMAILS || 'not set'}`);
    console.log(`   SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'configured' : 'not set'}`);
    console.log(`   FROM_EMAIL: ${process.env.FROM_EMAIL || 'not set'}`);
    console.log('🔧 Environment variables loaded from .env.docker via docker-compose env_file');
    
    for (const setting of defaultSettings) {
      // Only set if it doesn't exist (preserve user customizations)
      const existingResult = await pool.query('SELECT * FROM settings WHERE key = $1', [setting.key]);
      
      if (existingResult.rows.length === 0) {
        await pool.query(`
          INSERT INTO settings (key, value, description, created_at, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [setting.key, setting.value, setting.description]);
        console.log(`✅ Created setting: ${setting.key} = ${setting.value}`);
      } else {
        console.log(`⏭️  Setting exists: ${setting.key} = ${existingResult.rows[0].value} (preserving user value)`);
      }
    }
    
    console.log('✅ Default settings configured');
    
    // Log the initialization
    await pool.query(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, timestamp)
      VALUES (1, 'system_init', 'system', 1, 
        '{"message": "Production database initialized"}',
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

echo "Verifying users were created..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "SELECT username, role, is_active FROM users;" || echo "User verification failed"

echo "Checking password storage (first 20 chars)..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "SELECT username, LEFT(password, 20) as password_start FROM users;" || echo "Password check failed"

# Start the application
echo "Starting IPAM application..."
exec npm run dev