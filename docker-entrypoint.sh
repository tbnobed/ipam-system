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

# Run database migration
echo "Setting up database schema..."
if npm run db:push; then
  echo "Database schema setup completed successfully"
else
  echo "Database schema setup failed, but continuing..."
fi

# Ensure isActive column exists in users table
echo "Checking users table structure..."
PGPASSWORD=ipam_password psql -h postgres -U ipam_user -d ipam_db -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
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

const SALT_ROUNDS = 10;

async function setupProduction() {
  console.log('Setting up production database...');
  
  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin', SALT_ROUNDS);
    const adminUser = await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      isActive: true
    }).onConflictDoUpdate({
      target: users.username,
      set: {
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        updatedAt: new Date()
      }
    }).returning();
    
    console.log('✅ Admin user created/updated');
    
    // Create demo user
    const demoUserPassword = await bcrypt.hash('user', SALT_ROUNDS);
    await db.insert(users).values({
      username: 'user',
      password: demoUserPassword,
      role: 'user',
      isActive: true
    }).onConflictDoUpdate({
      target: users.username,
      set: {
        password: demoUserPassword,
        role: 'user',
        isActive: true,
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Demo user created/updated');
    
    // Create demo viewer
    const viewerPassword = await bcrypt.hash('viewer', SALT_ROUNDS);
    await db.insert(users).values({
      username: 'viewer',
      password: viewerPassword,
      role: 'viewer',
      isActive: true
    }).onConflictDoUpdate({
      target: users.username,
      set: {
        password: viewerPassword,
        role: 'viewer',
        isActive: true,
        updatedAt: new Date()
      }
    });
    
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
      await db.insert(settings).values(setting).onConflictDoUpdate({
        target: settings.key,
        set: {
          value: setting.value,
          description: setting.description,
          updatedAt: new Date()
        }
      });
    }
    
    console.log('✅ Default settings configured');
    
    // Log the initialization
    await db.insert(activityLogs).values({
      userId: adminUser[0].id,
      action: 'system_init',
      entityType: 'system',
      entityId: 1,
      details: { message: 'Production database initialized', timestamp: new Date() }
    });
    
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