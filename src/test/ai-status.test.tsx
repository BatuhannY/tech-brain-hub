import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AIStatusProvider, useAIStatus } from '@/hooks/useAIStatus';

const TestComponent = () => {
  const { isAIOffline, markAIOffline, markAIOnline, checkAIError } = useAIStatus();
  return (
    <div>
      <span data-testid="status">{isAIOffline ? 'offline' : 'online'}</span>
      <button onClick={markAIOffline}>go-offline</button>
      <button onClick={markAIOnline}>go-online</button>
      <button onClick={() => checkAIError({ error: 'Payment required 402' })}>check-payment</button>
      <button onClick={() => checkAIError({ error: 'Some other error' })}>check-other</button>
    </div>
  );
};

describe('AIStatusProvider', () => {
  it('starts online', () => {
    render(<AIStatusProvider><TestComponent /></AIStatusProvider>);
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('can go offline and back online', () => {
    render(<AIStatusProvider><TestComponent /></AIStatusProvider>);
    act(() => screen.getByText('go-offline').click());
    expect(screen.getByTestId('status').textContent).toBe('offline');
    act(() => screen.getByText('go-online').click());
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('detects payment errors and goes offline', () => {
    render(<AIStatusProvider><TestComponent /></AIStatusProvider>);
    act(() => screen.getByText('check-payment').click());
    expect(screen.getByTestId('status').textContent).toBe('offline');
  });

  it('does not go offline for non-payment errors', () => {
    render(<AIStatusProvider><TestComponent /></AIStatusProvider>);
    act(() => screen.getByText('check-other').click());
    expect(screen.getByTestId('status').textContent).toBe('online');
  });
});
