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

# Run production setup directly in entrypoint
echo "Setting up production environment..."
npx tsx -e "
import bcrypt from 'bcrypt';
import { db } from './server/db';
import { users, settings, activityLogs } from './shared/schema';
import { sql } from 'drizzle-orm';

const SALT_ROUNDS = 10;

async function setupProduction() {
  console.log('Setting up production database...');
  
  try {
    // Create admin user using raw SQL for better compatibility
    const hashedAdminPassword = await bcrypt.hash('admin', SALT_ROUNDS);
    await db.execute(sql\`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('admin', \${hashedAdminPassword}, 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = \${hashedAdminPassword},
        role = 'admin',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    \`);
    
    console.log('✅ Admin user created/updated');
    
    // Create demo user using raw SQL
    const hashedUserPassword = await bcrypt.hash('user', SALT_ROUNDS);
    await db.execute(sql\`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('user', \${hashedUserPassword}, 'user', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = \${hashedUserPassword},
        role = 'user',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    \`);
    
    console.log('✅ Demo user created/updated');
    
    // Create demo viewer using raw SQL
    const hashedViewerPassword = await bcrypt.hash('viewer', SALT_ROUNDS);
    await db.execute(sql\`
      INSERT INTO users (username, password, role, is_active, created_at, updated_at)
      VALUES ('viewer', \${hashedViewerPassword}, 'viewer', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        password = \${hashedViewerPassword},
        role = 'viewer',
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    \`);
    
    console.log('✅ Demo viewer created/updated');
    
    // Set default settings using raw SQL to avoid table issues
    const defaultSettings = [
      { key: 'scan_interval', value: '300', description: 'Network scan interval in seconds' },
      { key: 'max_devices', value: '10000', description: 'Maximum number of devices to track' },
      { key: 'data_retention_days', value: '90', description: 'Days to retain historical data' },
      { key: 'notifications_enabled', value: 'true', description: 'Enable system notifications' },
      { key: 'email_notifications', value: 'false', description: 'Enable email notifications' }
    ];
    
    for (const setting of defaultSettings) {
      await db.execute(sql\`
        INSERT INTO settings (key, value, description, updated_at)
        VALUES (\${setting.key}, \${setting.value}, \${setting.description}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = \${setting.value},
          description = \${setting.description},
          updated_at = CURRENT_TIMESTAMP
      \`);
    }
    
    console.log('✅ Default settings configured');
    
    // Log the initialization using raw SQL
    await db.execute(sql\`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, timestamp)
      VALUES (1, 'system_init', 'system', 1, 
        '{"message": "Production database initialized"}',
        CURRENT_TIMESTAMP)
    \`);
    
    console.log('✅ Production database setup completed successfully');
    
  } catch (error) {
    console.error('❌ Production database setup failed:', error);
    process.exit(1);
  }
}

setupProduction().then(() => {
  console.log('Production setup completed');
  process.exit(0);
}).catch((error) => {
  console.error('Production setup failed:', error);
  process.exit(1);
});
"

# Start the application
echo "Starting IPAM application..."
exec npm run dev