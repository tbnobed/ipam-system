import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Analytics() {
  return (
    <>
      <Header
        title="Network Analytics"
        subtitle="Analyze network performance and utilization trends"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500">
                Analytics dashboard coming soon. This will include:
              </p>
              <ul className="mt-4 text-left text-gray-600 max-w-md mx-auto space-y-2">
                <li>• Device uptime trends</li>
                <li>• Subnet utilization history</li>
                <li>• Network discovery patterns</li>
                <li>• Performance metrics</li>
                <li>• Alert summaries</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
