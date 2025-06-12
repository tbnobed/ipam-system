import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface HeaderProps {
  title: string;
  subtitle: string;
  showActions?: boolean;
  onScan?: () => void;
  onExport?: () => void;
}

export default function Header({ 
  title, 
  subtitle, 
  showActions = false,
  onScan,
  onExport 
}: HeaderProps) {
  const { data: lastScanTime } = useQuery({
    queryKey: ['/api/dashboard/last-scan'],
    refetchInterval: 30000, // Update every 30 seconds
  });

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          {showActions && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Last scan: {' '}
                <span className="font-medium">
                  {lastScanTime 
                    ? format(new Date(lastScanTime), 'MMM d, h:mm a')
                    : 'Never'
                  }
                </span>
              </div>
              <Button 
                onClick={onScan}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Scan Network
              </Button>
              <Button 
                variant="outline" 
                onClick={onExport}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
