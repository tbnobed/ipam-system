import { db } from "./db";
import { vlans, subnets } from "@shared/schema";

export async function initializeDatabase() {
  try {
    console.log("Initializing database with default data...");
    
    // Insert default VLANs
    const defaultVlans = await db.insert(vlans).values([
      {
        vlanId: 320,
        name: 'Plex Engineering Control',
        description: 'Engineering control network'
      },
      {
        vlanId: 321, 
        name: 'Production Network',
        description: 'Production equipment network'
      }
    ]).onConflictDoUpdate({
      target: vlans.vlanId,
      set: {
        name: vlans.name,
        description: vlans.description
      }
    }).returning();

    console.log("Created/updated VLANs:", defaultVlans);

    // Insert default subnets to match production environment
    const defaultSubnets = await db.insert(subnets).values([
      {
        network: '10.63.20.0/24',
        gateway: '10.63.20.1',
        vlanId: defaultVlans.find(v => v.vlanId === 320)?.id || 1,
        assignmentType: 'static',
        description: 'Engineering control subnet'
      },
      {
        network: '10.63.21.0/24',
        gateway: '10.63.21.1', 
        vlanId: defaultVlans.find(v => v.vlanId === 321)?.id || 2,
        assignmentType: 'static',
        description: 'Production equipment subnet'
      },
      {
        network: '10.63.250.0/24',
        gateway: '10.63.250.1',
        vlanId: defaultVlans.find(v => v.vlanId === 320)?.id || 1,
        assignmentType: 'static',
        description: 'Extended engineering network'
      },
      {
        network: '10.63.251.0/24',
        gateway: '10.63.251.1',
        vlanId: defaultVlans.find(v => v.vlanId === 321)?.id || 2,
        assignmentType: 'static',
        description: 'Extended production network'
      }
    ]).onConflictDoUpdate({
      target: subnets.network,
      set: {
        gateway: subnets.gateway,
        vlanId: subnets.vlanId,
        assignmentType: subnets.assignmentType,
        description: subnets.description
      }
    }).returning();

    console.log("Created/updated subnets:", defaultSubnets);
    console.log("Database initialization completed successfully");
    
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}