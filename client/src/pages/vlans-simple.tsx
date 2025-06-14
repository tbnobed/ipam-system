import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function VlansPage() {
  const [selectedSubnet, setSelectedSubnet] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: vlans = [] } = useQuery<any[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets = [] } = useQuery<any[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: devicesResponse } = useQuery<{data: any[]}>({
    queryKey: ['/api/devices'],
  });

  const devices = devicesResponse?.data || [];

  const handleViewSubnet = (subnet: any) => {
    setSelectedSubnet(subnet);
    setDialogOpen(true);
  };

  return (
    <>
      <Header title="VLANs & Subnets" subtitle="Network configuration and management" />
      <main className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">VLANs & Subnets</h1>
        
        <div className="grid gap-6">
          {vlans.map((vlan) => {
            const vlanSubnets = subnets.filter(subnet => subnet.vlanId === vlan.id);
            
            return (
              <Card key={vlan.id}>
                <CardHeader>
                  <CardTitle>VLAN {vlan.vlanId} - {vlan.name}</CardTitle>
                  <p className="text-sm text-gray-600">{vlan.description}</p>
                </CardHeader>
                <CardContent>
                  <h4 className="font-medium mb-4">Subnets ({vlanSubnets.length})</h4>
                  <div className="space-y-3">
                    {vlanSubnets.map((subnet) => {
                      const subnetDevices = devices.filter(device => device.subnetId === subnet.id);
                      
                      return (
                        <div 
                          key={subnet.id} 
                          className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => handleViewSubnet(subnet)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-medium">{subnet.network}</span>
                            <Badge variant="outline">{subnet.assignmentType}</Badge>
                            <Badge variant="secondary">{subnetDevices.length} devices</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Gateway: {subnet.gateway} | {subnet.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Simple Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Subnet Details: {selectedSubnet?.network}</DialogTitle>
              <DialogDescription>
                View IP addresses, device assignments, and network utilization
              </DialogDescription>
            </DialogHeader>
            {selectedSubnet && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-lg font-bold text-blue-600">254</div>
                    <div className="text-xs text-gray-600">Total IPs</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">
                      {254 - devices.filter(d => d.subnetId === selectedSubnet.id).length}
                    </div>
                    <div className="text-xs text-gray-600">Available</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded">
                    <div className="text-lg font-bold text-orange-600">
                      {devices.filter(d => d.subnetId === selectedSubnet.id).length}
                    </div>
                    <div className="text-xs text-gray-600">Used</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="text-lg font-bold text-purple-600">
                      {((devices.filter(d => d.subnetId === selectedSubnet.id).length / 254) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Utilization</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Devices ({devices.filter(d => d.subnetId === selectedSubnet.id).length})</h4>
                  <div className="border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">IP Address</th>
                          <th className="px-3 py-2 text-left">Hostname</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices
                          .filter(device => device.subnetId === selectedSubnet.id)
                          .map((device) => (
                            <tr key={device.id} className="border-t">
                              <td className="px-3 py-2 font-mono">{device.ipAddress}</td>
                              <td className="px-3 py-2">{device.hostname || 'Unknown'}</td>
                              <td className="px-3 py-2">
                                <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                                  {device.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}