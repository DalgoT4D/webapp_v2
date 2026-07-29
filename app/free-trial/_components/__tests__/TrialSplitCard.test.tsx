/**
 * Tests for the free-trial shell components.
 *
 * These exist mainly to lock the two contracts the rest of the flow depends on:
 * the split card renders its form slot unconditionally and its aside only when
 * given one, and the marketing panel renders carousel dots only when configured.
 */

import type { ImgHTMLAttributes } from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/image', () => {
  // `priority` is consumed by the real next/image and never reaches the DOM. Strip it
  // here too, otherwise React logs "Received `false` for a non-boolean attribute" and
  // buries any genuine warning this suite might surface.
  function MockImage({
    priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
    void priority;
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not the real app
    return <img alt="" {...props} />;
  }
  return MockImage;
});

import { TrialSplitCard } from '../TrialSplitCard';
import { TrialMarketingPanel } from '../TrialMarketingPanel';
import { TrialField } from '../TrialField';
import { TRIAL_MARKETING_PANELS } from '@/app/free-trial/_lib/constants';

describe('TrialSplitCard', () => {
  it('renders the form slot under the given testId', () => {
    render(
      <TrialSplitCard testId="trial-test-card">
        <p>form content</p>
      </TrialSplitCard>
    );

    expect(screen.getByTestId('trial-test-card')).toBeInTheDocument();
    expect(screen.getByText('form content')).toBeInTheDocument();
  });

  it('omits the marketing pane entirely when no aside is given', () => {
    render(
      <TrialSplitCard testId="trial-test-card">
        <p>form content</p>
      </TrialSplitCard>
    );

    expect(screen.queryByTestId('trial-marketing-panel')).not.toBeInTheDocument();
  });

  it('renders the marketing pane when an aside is given', () => {
    render(
      <TrialSplitCard
        testId="trial-test-card"
        aside={<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.signup} />}
      >
        <p>form content</p>
      </TrialSplitCard>
    );

    expect(screen.getByTestId('trial-marketing-panel')).toBeInTheDocument();
    expect(screen.getByText(TRIAL_MARKETING_PANELS.signup.headline)).toBeInTheDocument();
  });
});

describe('TrialMarketingPanel', () => {
  it('renders no carousel dots when activeDot is null', () => {
    render(<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.signup} />);
    expect(screen.queryByTestId('trial-panel-dots')).not.toBeInTheDocument();
  });

  it('renders the subline for a panel with no headline', () => {
    render(<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.provisioning} />);

    expect(screen.getByText(TRIAL_MARKETING_PANELS.provisioning.subline)).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('TrialField', () => {
  it('associates the label with the control via htmlFor/id', () => {
    render(
      <TrialField id="test-input" label="Email ID">
        <input id="test-input" />
      </TrialField>
    );

    expect(screen.getByLabelText('Email ID')).toBeInTheDocument();
  });

  it('renders the error under a predictable testid when given one', () => {
    render(
      <TrialField id="test-input" label="Email ID" error="Required field">
        <input id="test-input" />
      </TrialField>
    );

    expect(screen.getByTestId('test-input-error')).toHaveTextContent('Required field');
  });

  it('renders no error node when no error is given', () => {
    render(
      <TrialField id="test-input" label="Email ID">
        <input id="test-input" />
      </TrialField>
    );

    expect(screen.queryByTestId('test-input-error')).not.toBeInTheDocument();
  });
});
