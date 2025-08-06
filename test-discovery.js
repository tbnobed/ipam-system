// Test script to demonstrate the new discovery-based import process
import { discoveryService } from './server/discovery.js';

console.log('🧪 Testing dynamic VLAN-subnet discovery...');

async function testDiscovery() {
  try {
    const results = await discoveryService.discoverVlanSubnetRelationships();
    console.log('Discovery Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Discovery test failed:', error);
  }
}

testDiscovery();