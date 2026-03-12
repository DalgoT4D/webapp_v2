'use client';

/**
 * Table chart customizations component.
 * Currently tables don't have many customization options,
 * but this placeholder allows for future expansion.
 */

interface TableChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
}

export function TableChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: TableChartCustomizationsProps) {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <p>Table charts are configured through the data configuration panel.</p>
      <p className="text-sm mt-2">
        Use the dimensions selector to configure columns and enable drill-down.
      </p>
    </div>
  );
}
