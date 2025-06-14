// Script to redistribute devices to correct subnets based on IP addresses
// Run this in your production environment to fix the device assignments

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function redistributeDevices() {
  const client = await pool.connect();
  
  try {
    // Get all subnets
    const subnetsResult = await client.query('SELECT id, network FROM subnets ORDER BY id');
    const subnets = subnetsResult.rows;
    
    console.log('Found subnets:', subnets);
    
    // Get all devices that need reassignment
    const devicesResult = await client.query('SELECT id, ip_address, subnet_id FROM devices');
    const devices = devicesResult.rows;
    
    console.log(`Found ${devices.length} devices to check`);
    
    let reassigned = 0;
    
    for (const device of devices) {
      const correctSubnet = findSubnetForIP(device.ip_address, subnets);
      
      if (correctSubnet && correctSubnet.id !== device.subnet_id) {
        await client.query(
          'UPDATE devices SET subnet_id = $1 WHERE id = $2',
          [correctSubnet.id, device.id]
        );
        console.log(`Reassigned ${device.ip_address} from subnet ${device.subnet_id} to ${correctSubnet.id}`);
        reassigned++;
      }
    }
    
    console.log(`Reassigned ${reassigned} devices`);
    
    // Show final distribution
    const finalResult = await client.query(`
      SELECT s.id, s.network, COUNT(d.id) as device_count 
      FROM subnets s 
      LEFT JOIN devices d ON s.id = d.subnet_id 
      GROUP BY s.id, s.network 
      ORDER BY s.id
    `);
    
    console.log('Final device distribution:');
    finalResult.rows.forEach(row => {
      console.log(`Subnet ${row.id} (${row.network}): ${row.device_count} devices`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

function findSubnetForIP(ipAddress, subnets) {
  const ipParts = ipAddress.split('.').map(Number);
  const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
  
  for (const subnet of subnets) {
    const [networkAddr, cidrBits] = subnet.network.split('/');
    const cidr = parseInt(cidrBits);
    const hostBits = 32 - cidr;
    
    const networkParts = networkAddr.split('.').map(Number);
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const broadcastInt = networkInt + Math.pow(2, hostBits) - 1;
    
    if (ipInt >= networkInt && ipInt <= broadcastInt) {
      return subnet;
    }
  }
  
  return null;
}

redistributeDevices().catch(console.error);