#!/usr/bin/env node

// Simple test to verify environment variable loading
console.log('🧪 Testing Environment Variable Loading');
console.log('=====================================');

console.log('Current working directory:', process.cwd());
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('DEFAULT_SCAN_INTERVAL:', process.env.DEFAULT_SCAN_INTERVAL || 'not set');
console.log('DATA_RETENTION_DAYS:', process.env.DATA_RETENTION_DAYS || 'not set');
console.log('ALERT_EMAILS:', process.env.ALERT_EMAILS || 'not set');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'set' : 'not set');
console.log('FROM_EMAIL:', process.env.FROM_EMAIL || 'not set');

// Check if .env.docker exists
import fs from 'fs';
import path from 'path';

const envDockerPath = path.join(process.cwd(), '.env.docker');
console.log('\n📁 File system check:');
console.log('.env.docker exists:', fs.existsSync(envDockerPath));

if (fs.existsSync(envDockerPath)) {
    console.log('.env.docker contents:');
    const contents = fs.readFileSync(envDockerPath, 'utf8');
    console.log(contents.substring(0, 500) + '...');
}

console.log('\n🔧 Environment loading test complete');