import Header from "@/components/layout/header";
import DeviceTable from "@/components/dashboard/device-table";
import AddDeviceModal from "@/components/modals/add-device-modal";
import { useAuth } from "@/contexts/AuthContext";

export default function Devices() {
  const { user } = useAuth();
  
  // Only show Add Device button for admins and users with write permissions
  const canAddDevice = user?.role === "admin" || user?.role === "user";
  
  return (
    <>
      <Header
        title="Device Management"
        subtitle="View and manage all network devices"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">All Devices</h2>
            <p className="text-sm text-gray-600 mt-1">
              {canAddDevice 
                ? "Manually add devices that may not be discoverable through network scanning"
                : "View all network devices discovered through scanning"
              }
            </p>
          </div>
          {canAddDevice && <AddDeviceModal />}
        </div>
        <DeviceTable />
      </main>
    </>
  );
}
