import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmbedCoverageDialog } from '@/components/sharing/embed-coverage-dialog';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 1,
    title: 'Attendance by District',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

import type { PrincipalGap } from '@/hooks/api/useResourceAccess';

const fieldStaffGap: PrincipalGap = {
  principal_type: 'group',
  principal_id: 8,
  name: 'Field Staff',
  email: null,
  skipped_member: false,
};

describe('EmbedCoverageDialog', () => {
  it('gap + edit: frame copy asks to add the audience to the chart share list; YES extends', () => {
    const onConfirm = jest.fn();
    render(
      <EmbedCoverageDialog
        open
        containerName="Field Operations Dashboard"
        verdicts={[
          verdict({ principal_gaps: [fieldStaffGap], extendable: true, viewer_can_edit: true }),
        ]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Update permissions?')).toBeInTheDocument();
    const body = screen.getByTestId('embed-coverage-body');
    expect(body).toHaveTextContent(
      "This chart isn't visible to some viewers of 'Field Operations Dashboard' (Field Staff group)."
    );
    expect(body).toHaveTextContent("Add Field Staff group to this chart's share list?");

    fireEvent.click(screen.getByTestId('embed-coverage-yes'));
    expect(onConfirm).toHaveBeenCalledWith({ extendChartIds: [1], proceed: true });
  });

  it('names the chart when there is more than one verdict (autosave 409 recovery)', () => {
    render(
      <EmbedCoverageDialog
        open
        containerName="Ops"
        verdicts={[
          verdict({ chart_id: 1, title: 'A', extendable: true, viewer_can_edit: true }),
          verdict({ chart_id: 2, title: 'B', extendable: true, viewer_can_edit: true }),
        ]}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    const list = screen.getByTestId('embed-coverage-charts');
    expect(list).toHaveTextContent('A');
    expect(list).toHaveTextContent('B');
  });

  it('gap + view-only: request-Edit/ask-owner prompt instead of YES', () => {
    const onRequestEdit = jest.fn();
    render(
      <EmbedCoverageDialog
        open
        containerName="Ops"
        verdicts={[
          verdict({ principal_gaps: [fieldStaffGap], extendable: true, viewer_can_edit: false }),
        ]}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRequestEdit={onRequestEdit}
      />
    );

    expect(screen.queryByTestId('embed-coverage-yes')).not.toBeInTheDocument();
    const body = screen.getByTestId('embed-coverage-body');
    expect(body).toHaveTextContent(/you need edit access/i);
    expect(body).toHaveTextContent(/ask the chart's owner/i);

    fireEvent.click(screen.getByTestId('embed-coverage-request-edit'));
    expect(onRequestEdit).toHaveBeenCalledWith([1]);
  });

  it('informational-only exposure (member/public): YES = proceed, copy says the chart stays visible', () => {
    const onConfirm = jest.fn();
    render(
      <EmbedCoverageDialog
        open
        containerName="Ops"
        verdicts={[verdict({ role_gaps: ['member'] })]}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    const body = screen.getByTestId('embed-coverage-body');
    expect(body).toHaveTextContent(/will still be shown inside/i);

    fireEvent.click(screen.getByTestId('embed-coverage-yes'));
    expect(onConfirm).toHaveBeenCalledWith({ extendChartIds: [], proceed: true });
  });

  it('CANCEL is the default (focused) and aborts without confirming', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <EmbedCoverageDialog
        open
        containerName="Ops"
        verdicts={[
          verdict({ principal_gaps: [fieldStaffGap], extendable: true, viewer_can_edit: true }),
        ]}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const cancel = screen.getByTestId('embed-coverage-cancel');
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
