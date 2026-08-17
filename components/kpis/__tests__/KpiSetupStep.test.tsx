import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { KpiSetupStep } from '../KpiSetupStep';
import type { KPIFormData } from '../kpi-form-types';

function TestKpiSetupStep({ isEdit = false }: { isEdit?: boolean }) {
  const {
    control,
    register,
    formState: { errors },
  } = useForm<KPIFormData>();

  return (
    <KpiSetupStep
      control={control}
      register={register}
      errors={errors}
      isEdit={isEdit}
      dateColumns={[]}
      selectedMetric={undefined}
      onDirectionChange={jest.fn()}
    />
  );
}

describe('KpiSetupStep naming guidance', () => {
  it('connects the dashboard naming hint to the new KPI name field', () => {
    render(<TestKpiSetupStep />);

    expect(screen.getByLabelText(/Name this KPI/)).toHaveAttribute(
      'aria-describedby',
      'kpi-name-guidance'
    );
    expect(screen.getByText(/easy to find when adding it to a dashboard/i)).toBeInTheDocument();
  });

  it('does not show creation guidance while editing an existing KPI', () => {
    render(<TestKpiSetupStep isEdit />);

    expect(
      screen.queryByText(/easy to find when adding it to a dashboard/i)
    ).not.toBeInTheDocument();
  });
});
