import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BroadeningConfirmDialog } from '@/components/sharing/broadening-confirm-dialog';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 1,
    title: 'Chart',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

const funderGapVerdicts: ChartCoverageVerdict[] = [
  verdict({
    chart_id: 1,
    title: 'Salary Breakdown',
    principal_gaps: [
      {
        principal_type: 'group',
        principal_id: 4,
        name: 'Funders',
        email: null,
        skipped_member: false,
      },
    ],
    extendable: true,
    viewer_can_edit: true,
  }),
  verdict({
    chart_id: 2,
    title: 'Field Visits',
    principal_gaps: [
      {
        principal_type: 'group',
        principal_id: 4,
        name: 'Funders',
        email: null,
        skipped_member: false,
      },
    ],
    extendable: true,
    viewer_can_edit: true,
  }),
];

describe('BroadeningConfirmDialog', () => {
  it('renders the frame copy: resource name, count, audience, extend-all', () => {
    render(
      <BroadeningConfirmDialog
        open
        resourceName="Untitled Dashboard"
        verdicts={funderGapVerdicts}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(screen.getByText('Share "Untitled Dashboard"')).toBeInTheDocument();
    const body = screen.getByTestId('broadening-confirm-body');
    expect(body).toHaveTextContent('Are you sure you want to share "Untitled Dashboard"?');
    expect(body).toHaveTextContent("2 charts in this dashboard aren't shared with Funders group.");
    expect(body).toHaveTextContent('Extend all 2.');
  });

  it('names every affected chart', () => {
    render(
      <BroadeningConfirmDialog
        open
        resourceName="Untitled Dashboard"
        verdicts={funderGapVerdicts}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    const list = screen.getByTestId('broadening-confirm-charts');
    expect(list).toHaveTextContent('Salary Breakdown');
    expect(list).toHaveTextContent('Field Visits');
  });

  it('defaults emphasis to CANCEL (focused, danger styling) and cancels without confirming', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <BroadeningConfirmDialog
        open
        resourceName="D"
        verdicts={funderGapVerdicts}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const cancel = screen.getByTestId('broadening-confirm-cancel');
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('YES confirms with the extendable-and-editable chart ids and proceed', () => {
    const onConfirm = jest.fn();
    render(
      <BroadeningConfirmDialog
        open
        resourceName="D"
        verdicts={[
          funderGapVerdicts[0],
          verdict({ chart_id: 3, title: 'No Edit', extendable: true, viewer_can_edit: false }),
        ]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));
    expect(onConfirm).toHaveBeenCalledWith({ extendChartIds: [1], proceed: true });
  });

  it('for a non-extendable exposure (public link), YES = proceed and the copy says charts stay visible', () => {
    const onConfirm = jest.fn();
    render(
      <BroadeningConfirmDialog
        open
        resourceName="D"
        verdicts={[verdict({ chart_id: 5, title: 'Salary Breakdown', public_exposure: true })]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    const body = screen.getByTestId('broadening-confirm-body');
    expect(body).not.toHaveTextContent('Extend all');
    expect(body).toHaveTextContent(/will still be visible inside it/i);

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));
    expect(onConfirm).toHaveBeenCalledWith({ extendChartIds: [], proceed: true });
  });
});
