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
import tbnLogo from "@/assets/tbn-logo.webp";

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
    <div className="hidden md:flex md:w-72 md:flex-col">
      <div className="flex flex-col flex-grow bg-white border-r border-gray-100 shadow-sm">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-50">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-10 h-8 flex items-center justify-center">
              <img 
                src={tbnLogo} 
                alt="TBN"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">IPAM</h1>
              <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">Network Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-grow flex flex-col py-6">
          <nav className="flex-1 px-4 space-y-2">
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
                    "group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}>
                    <Icon className={cn(
                      "mr-4 flex-shrink-0 h-5 w-5 transition-colors",
                      isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                    )} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 px-4 py-4 mt-6 border-t border-gray-100">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center min-w-0 flex-1">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <User className="text-white w-5 h-5" />
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
                  <p className="text-xs font-medium text-gray-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors ml-2"
                title="Sign out"
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
