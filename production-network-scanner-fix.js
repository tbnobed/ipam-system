// Copy this content to your production server/network.ts file
// This contains the critical fixes to prevent device clustering

// Find the performScan method and replace the device processing section with:

/*
Replace this section in your production server/network.ts around lines 160-187:

        // Update device statuses in database - only process devices that belong to this subnet
        for (const result of subnetResults) {
          const correctSubnetId = await this.findSubnetForIP(result.ipAddress);
          if (correctSubnetId === subnet.id) {
            await this.updateDeviceFromScan(result, subnet.id);
          }
          // If device belongs to a different subnet, skip it for now - it will be processed when that subnet is scanned
        }

        // Only broadcast devices that actually belong to this subnet
        const validDevices = [];
        for (const result of subnetResults) {
          const correctSubnetId = await this.findSubnetForIP(result.ipAddress);
          if (correctSubnetId === subnet.id) {
            validDevices.push(result);
          }
        }

        // Broadcast found devices
        this.broadcastScanUpdate({
          status: 'subnet_complete',
          subnet: subnet.network,
          devicesFound: validDevices.length,
          newDevices: validDevices.filter(d => d.isAlive)
        });
*/