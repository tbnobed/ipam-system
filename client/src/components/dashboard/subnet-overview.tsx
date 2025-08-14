import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import type { SubnetUtilization } from "@/lib/types";

interface SubnetOverviewProps {
  subnets: SubnetUtilization[];
}

export default function SubnetOverview({ subnets }: SubnetOverviewProps) {
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
      <CardContent className="p-4 h-96">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-full overflow-y-auto">
          {subnets
            .sort((a, b) => b.utilization - a.utilization)
            .map((subnet) => (
            <div key={subnet.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border h-fit">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate mb-2">
                {subnet.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {subnet.utilization}% used
              </div>
              <Progress 
                value={subnet.utilization} 
                className="h-1.5 mb-2"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {subnet.available} avail
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
