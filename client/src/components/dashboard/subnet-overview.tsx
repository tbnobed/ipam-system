import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import type { SubnetUtilization } from "@/lib/types";

interface SubnetOverviewProps {
  subnets: SubnetUtilization[];
}

export default function SubnetOverview({ subnets }: SubnetOverviewProps) {
  console.log('SubnetOverview received subnets:', subnets);
  
  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return "bg-red-500";
    if (utilization >= 75) return "bg-orange-500";
    return "bg-primary";
  };

  if (!subnets || subnets.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Subnet Utilization</CardTitle>
          <Link href="/vlans">
            <Button variant="link" className="text-primary">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No subnets configured. Add VLANs and subnets to see utilization data.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subnet Utilization</CardTitle>
        <Link href="/vlans">
          <Button variant="link" className="text-primary">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {subnets.map((subnet) => (
            <div key={subnet.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{subnet.name}</span>
                <span className="text-sm text-gray-500">{subnet.utilization}% used</span>
              </div>
              <Progress 
                value={subnet.utilization} 
                className="h-2 mb-2"
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{subnet.description}</span>
                <span>{subnet.available} available</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
