import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { Vlan, Subnet } from "@shared/schema";

export default function VLANs() {
  const { data: vlans, isLoading: vlansLoading } = useQuery<Vlan[]>({
    queryKey: ['/api/vlans'],
  });

  const { data: subnets, isLoading: subnetsLoading } = useQuery<Subnet[]>({
    queryKey: ['/api/subnets'],
  });

  const getSubnetsForVlan = (vlanId: number) => {
    return subnets?.filter(subnet => subnet.vlanId === vlanId) || [];
  };

  if (vlansLoading || subnetsLoading) {
    return <div className="flex items-center justify-center h-64">Loading VLANs...</div>;
  }

  return (
    <>
      <Header
        title="VLANs & Subnets"
        subtitle="Manage network segmentation and IP address spaces"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Virtual LANs</h3>
          <div className="space-x-2">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add VLAN
            </Button>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Subnet
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {vlans?.map((vlan) => {
            const vlanSubnets = getSubnetsForVlan(vlan.id);
            
            return (
              <Card key={vlan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <CardTitle>VLAN {vlan.vlanId}</CardTitle>
                      <Badge variant="secondary">{vlan.name}</Badge>
                      {vlan.cableColor && (
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: vlan.cableColor }}
                          title={`Cable Color: ${vlan.cableColor}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{vlan.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Subnets</h4>
                    {vlanSubnets.length > 0 ? (
                      <div className="grid gap-4">
                        {vlanSubnets.map((subnet) => (
                          <div key={subnet.id} className="p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-4">
                                <span className="font-mono text-sm font-medium">
                                  {subnet.network}
                                </span>
                                <Badge variant="outline">
                                  {subnet.assignmentType.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Gateway: </span>
                                <span className="font-mono">{subnet.gateway}</span>
                              </div>
                              <div>
                                <span className="font-medium">Description: </span>
                                {subnet.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No subnets configured</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
