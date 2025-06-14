// Fix device distribution in production database
// Run this script in your production environment to redistribute devices correctly

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ipam'
});

async function fixDeviceDistribution() {
  const client = await pool.connect();
  
  try {
    console.log('Checking current device distribution...');
    
    // Show current distribution
    const currentDist = await client.query(`
      SELECT 
        s.id as subnet_id,
        s.network,
        COUNT(d.id) as device_count
      FROM subnets s 
      LEFT JOIN devices d ON s.id = d.subnet_id 
      GROUP BY s.id, s.network 
      ORDER BY s.id
    `);
    
    console.log('Current distribution:');
    currentDist.rows.forEach(row => {
      console.log(`  Subnet ${row.subnet_id} (${row.network}): ${row.device_count} devices`);
    });
    
    // Get all subnets for reference
    const subnets = await client.query('SELECT id, network FROM subnets ORDER BY id');
    console.log('\nAvailable subnets:');
    subnets.rows.forEach(subnet => {
      console.log(`  ID ${subnet.id}: ${subnet.network}`);
    });
    
    // Fix devices in 10.63.21.x range to be assigned to correct subnet
    console.log('\nFixing device assignments...');
    
    // Find subnet ID for 10.63.21.0/24
    const subnet21 = subnets.rows.find(s => s.network === '10.63.21.0/24');
    if (!subnet21) {
      console.log('Error: Could not find subnet for 10.63.21.0/24');
      return;
    }
    
    // Update devices with 10.63.21.x IPs to correct subnet
    const updateResult = await client.query(`
      UPDATE devices 
      SET subnet_id = $1 
      WHERE ip_address LIKE '10.63.21.%' 
      AND subnet_id != $1
      RETURNING ip_address, subnet_id
    `, [subnet21.id]);
    
    console.log(`Updated ${updateResult.rowCount} devices to subnet ${subnet21.id}`);
    
    if (updateResult.rows.length > 0) {
      console.log('Sample updated devices:');
      updateResult.rows.slice(0, 5).forEach(device => {
        console.log(`  ${device.ip_address} -> subnet ${device.subnet_id}`);
      });
    }
    
    // Show final distribution
    const finalDist = await client.query(`
      SELECT 
        s.id as subnet_id,
        s.network,
        COUNT(d.id) as device_count
      FROM subnets s 
      LEFT JOIN devices d ON s.id = d.subnet_id 
      GROUP BY s.id, s.network 
      ORDER BY s.id
    `);
    
    console.log('\nFinal distribution:');
    finalDist.rows.forEach(row => {
      console.log(`  Subnet ${row.subnet_id} (${row.network}): ${row.device_count} devices`);
    });
    
  } catch (error) {
    console.error('Error fixing device distribution:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  fixDeviceDistribution().catch(console.error);
}

module.exports = { fixDeviceDistribution };