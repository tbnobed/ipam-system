import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import VLANs from "@/pages/vlans";
import Devices from "@/pages/devices";
import Discovery from "@/pages/discovery";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Sidebar from "@/components/layout/sidebar";
import NotFound from "@/pages/not-found";
import ScanStatusIndicator from "@/components/global/scan-status-indicator";

function Router() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/vlans" component={VLANs} />
          <Route path="/devices" component={Devices} />
          <Route path="/discovery" component={Discovery} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <ScanStatusIndicator />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
