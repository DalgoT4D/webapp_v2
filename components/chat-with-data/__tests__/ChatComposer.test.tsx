import { render, screen } from '@testing-library/react';
import { ChatComposer } from '../ChatComposer';

describe('ChatComposer', () => {
  it('warns against typing PII into the composer', () => {
    render(<ChatComposer draft="" onDraftChange={jest.fn()} onSend={jest.fn()} disabled={false} />);
    expect(screen.getByTestId('chat-pii-notice')).toHaveTextContent("Don't enter PII data here");
  });
});
