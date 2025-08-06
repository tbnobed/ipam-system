import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Network, 
  BarChart3, 
  Server, 
  Search, 
  TrendingUp, 
  Settings, 
  User,
  Users,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "VLANs & Subnets", href: "/vlans", icon: Network },
  { name: "Devices", href: "/devices", icon: Server },
  { name: "Discovery", href: "/discovery", icon: Search },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-12 h-8 flex items-center justify-center">
              <img 
                src="@assets/tbn_logo_1754505164327.webp" 
                alt="TBN"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-semibold text-gray-900">IPAM</h1>
              <p className="text-xs text-gray-500">Network Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex-grow flex flex-col">
          <nav className="flex-1 px-4 space-y-1">
            {navigation.map((item) => {
              // Hide Users and Settings menu for non-admin users
              if ((item.name === "Users" || item.name === "Settings") && user?.role !== "admin") {
                return null;
              }
              
              // Hide Discovery and Analytics pages for viewer users
              if (user?.role === "viewer" && (
                item.name === "Discovery" || 
                item.name === "Analytics"
              )) {
                return null;
              }
              
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link key={item.name} href={item.href}>
                  <div className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 border-r-2 border-primary text-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  )}>
                    <Icon className={cn(
                      "mr-3 flex-shrink-0 h-4 w-4",
                      isActive ? "text-primary" : "text-gray-400"
                    )} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="text-gray-600 w-4 h-4" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">{user?.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-gray-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
