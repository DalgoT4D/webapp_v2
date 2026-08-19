import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';
import { WarehouseDisplay } from '@/components/ingest/warehouse/warehouse-display';

export default function SettingsWarehousePage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <div className="h-full flex flex-col" data-testid="settings-warehouse-page">
        <div className="flex-shrink-0 border-b bg-background p-6 pb-4">
          <h1 className="text-3xl font-bold">Warehouse</h1>
          <p className="text-muted-foreground mt-1">A single place to store all your data</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <WarehouseDisplay />
        </div>
      </div>
    </RoleGuard>
  );
}
