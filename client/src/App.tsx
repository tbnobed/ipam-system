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
import Settings from "@/pages/settings-new";
import Users from "@/pages/users";
import LoginPage from "@/pages/login";
import Sidebar from "@/components/layout/sidebar";
import NotFound from "@/pages/not-found";
import ScanStatusIndicator from "@/components/global/scan-status-indicator";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function Router() {
  const { user, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/vlans" component={VLANs} />
          <Route path="/devices" component={Devices} />
          {user.role !== "viewer" && <Route path="/discovery" component={Discovery} />}
          {user.role !== "viewer" && <Route path="/analytics" component={Analytics} />}
          {user.role === "admin" && <Route path="/settings" component={Settings} />}
          {user.role === "admin" && <Route path="/users" component={Users} />}
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
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
