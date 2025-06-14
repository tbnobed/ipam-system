# Production Deployment Fix Guide

## Critical Files to Update in Production

### 1. server/storage.ts - Device Query Fix
Replace the `getDevices` method around line 180 with:

```typescript
async getDevices(filters: DeviceFilters): Promise<PaginatedResponse<Device>> {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  let conditions = [];

  if (filters.search) {
    conditions.push(
      sql`(${devices.ipAddress} LIKE ${`%${filters.search}%`} OR ${devices.hostname} LIKE ${`%${filters.search}%`})`
    );
  }

  if (filters.status) {
    conditions.push(eq(devices.status, filters.status));
  }

  if (filters.vlan) {
    conditions.push(sql`${devices.subnetId} IN (
      SELECT s.id FROM ${subnets} s 
      JOIN ${vlans} v ON s.vlan_id = v.id 
      WHERE v.vlan_id = ${parseInt(filters.vlan)}
    )`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Query with proper JOIN to ensure all devices with valid subnets are returned
  const data = await db.select({
    id: devices.id,
    ipAddress: devices.ipAddress,
    hostname: devices.hostname,
    macAddress: devices.macAddress,
    vendor: devices.vendor,
    deviceType: devices.deviceType,
    purpose: devices.purpose,
    location: devices.location,
    subnetId: devices.subnetId,
    status: devices.status,
    lastSeen: devices.lastSeen,
    openPorts: devices.openPorts,
    assignmentType: devices.assignmentType,
    createdAt: devices.createdAt,
    updatedAt: devices.updatedAt,
  })
    .from(devices)
    .leftJoin(subnets, eq(devices.subnetId, subnets.id))
    .where(whereClause)
    .orderBy(devices.id) // Use ID ordering for consistent pagination
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(devices)
    .leftJoin(subnets, eq(devices.subnetId, subnets.id))
    .where(whereClause);

  return {
    data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
}
```

### 2. server/network.ts - Device Assignment Fix
In the `performScan` method around lines 163-187, replace the device processing section:

```typescript
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
```

## Deployment Steps

1. **Update Code Files**
   ```bash
   cd ~/ipam-system
   # Copy the fixed methods above into your production files
   ```

2. **Rebuild Containers**
   ```bash
   sudo docker-compose down
   sudo docker-compose up -d --build
   ```

3. **Verify Fix**
   ```bash
   # Check device distribution
   curl -s "http://localhost:5000/api/devices?limit=200" | grep -o '"subnetId":[0-9]*' | sort | uniq -c
   
   # Should show both subnets:
   # 92 "subnetId":16
   # 31 "subnetId":17
   ```

## What These Fixes Address

1. **API Query Issue**: The device query now uses proper JOINs and consistent ordering
2. **Network Scanner Clustering**: Validates device IP addresses against subnet ranges
3. **Future Deployments**: Prevents regression of device clustering issues
4. **Consistent Pagination**: Uses ID-based ordering instead of IP-based for reliable pagination

## Database State Verification

Your database already shows correct distribution:
- Subnet 16: 92 devices (10.63.20.x range)
- Subnet 17: 31 devices (10.63.21.x range)

The fixes ensure the API properly returns all devices and future scans maintain correct assignments.