import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const deviceSchema = z.object({
  ipAddress: z.string().min(1, "IP address is required"),
  hostname: z.string().optional(),
  deviceType: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
  subnetId: z.string().min(1, "Subnet is required"),
  assignmentType: z.enum(["static", "dhcp"]).default("static"),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

export default function AddDeviceModal() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: subnets = [] } = useQuery<any[]>({
    queryKey: ['/api/subnets'],
  });

  const { data: devices = { data: [] } } = useQuery<any>({
    queryKey: ['/api/devices'],
  });

  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      assignmentType: "static",
    },
  });

  const selectedSubnetId = form.watch("subnetId");
  
  const availableIPs = useMemo(() => {
    if (!selectedSubnetId) return [];
    
    const subnet = subnets.find((s: any) => s.id.toString() === selectedSubnetId);
    if (!subnet) return [];
    
    // Parse network CIDR
    const [networkAddr, cidrBits] = subnet.network.split('/');
    const cidr = parseInt(cidrBits);
    const hostBits = 32 - cidr;
    
    // Generate IP range
    const networkParts = networkAddr.split('.').map(Number);
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const broadcastInt = networkInt + Math.pow(2, hostBits) - 1;
    
    // Get used IPs by checking if IP falls within this subnet range
    const usedIPs = new Set();
    
    devices.data.forEach((device: any) => {
      if (device.ipAddress) {
        // Check if this IP falls within the selected subnet range
        const deviceIPParts = device.ipAddress.split('.').map(Number);
        const deviceIPInt = (deviceIPParts[0] << 24) + (deviceIPParts[1] << 16) + (deviceIPParts[2] << 8) + deviceIPParts[3];
        
        // Check if device IP is within this subnet's range
        if (deviceIPInt >= networkInt + 1 && deviceIPInt <= broadcastInt - 1) {
          usedIPs.add(device.ipAddress);
        }
      }
    });
    
    // Add gateway to used IPs
    usedIPs.add(subnet.gateway);
    
    // Generate available IPs
    const availableList: string[] = [];
    for (let i = networkInt + 1; i < broadcastInt; i++) {
      const ip = [
        (i >>> 24) & 255,
        (i >>> 16) & 255,
        (i >>> 8) & 255,
        i & 255
      ].join('.');
      
      if (!usedIPs.has(ip)) {
        availableList.push(ip);
      }
    }
    
    return availableList;
  }, [selectedSubnetId, subnets, devices]);

  const onSubmit = async (data: DeviceFormData) => {
    try {
      await apiRequest('/api/devices', 'POST', {
        ...data,
        subnetId: parseInt(data.subnetId),
      });

      toast({
        title: "Success",
        description: "Device added successfully",
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add device",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Add a new device to the network inventory with IP address, hostname, and device details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subnetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subnet</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subnet first" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subnets.map((subnet: any) => (
                        <SelectItem key={subnet.id} value={subnet.id.toString()}>
                          {subnet.network} - {subnet.description || 'No description'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Available IP Address 
                    {selectedSubnetId && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({availableIPs.length} available)
                      </span>
                    )}
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedSubnetId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          selectedSubnetId ? "Select an available IP address" : "Select subnet first"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {availableIPs.map((ip: string) => (
                        <SelectItem key={ip} value={ip}>
                          <span className="font-mono">{ip}</span>
                        </SelectItem>
                      ))}
                      {availableIPs.length === 0 && selectedSubnetId && (
                        <div className="p-2 text-center text-gray-500 text-sm">
                          No available IP addresses in this subnet
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hostname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hostname</FormLabel>
                  <FormControl>
                    <Input placeholder="device-hostname" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Camera">Camera</SelectItem>
                      <SelectItem value="Router">Router</SelectItem>
                      <SelectItem value="Switch">Switch</SelectItem>
                      <SelectItem value="Audio">Audio Equipment</SelectItem>
                      <SelectItem value="Server">Server</SelectItem>
                      <SelectItem value="Workstation">Workstation</SelectItem>
                      <SelectItem value="Firewall">Firewall</SelectItem>
                      <SelectItem value="Storage">Storage Device</SelectItem>
                      <SelectItem value="Printer">Printer</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Studio A - Rack 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Input placeholder="Production Camera" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="static">Static</SelectItem>
                      <SelectItem value="dhcp">DHCP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Device</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
