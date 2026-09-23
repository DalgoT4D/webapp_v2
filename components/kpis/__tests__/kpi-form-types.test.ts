import { DEFAULT_KPI_DECIMAL_PLACES } from '../kpi-form-types';

describe('KPI form defaults', () => {
  it('defaults newly created KPIs to two decimal places', () => {
    expect(DEFAULT_KPI_DECIMAL_PLACES).toBe('2');
  });
});
