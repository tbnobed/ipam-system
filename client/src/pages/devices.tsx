import Header from "@/components/layout/header";
import DeviceTable from "@/components/dashboard/device-table";

export default function Devices() {
  return (
    <>
      <Header
        title="Device Management"
        subtitle="View and manage all network devices"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <DeviceTable />
      </main>
    </>
  );
}
