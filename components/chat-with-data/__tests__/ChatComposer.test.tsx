import { render, screen } from '@testing-library/react';
import { ChatComposer } from '../ChatComposer';

describe('ChatComposer', () => {
  it.each(['docked', 'hero'] as const)(
    'warns against typing PII via the default placeholder (%s)',
    (variant) => {
      render(
        <ChatComposer
          draft=""
          onDraftChange={jest.fn()}
          onSend={jest.fn()}
          disabled={false}
          variant={variant}
        />
      );
      expect(screen.getByTestId('chat-composer-input')).toHaveAttribute(
        'placeholder',
        'Ask about your program data. Avoid writing PII info...'
      );
    }
  );
});
