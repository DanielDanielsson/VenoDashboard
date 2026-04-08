// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SharedTimersPanel } from './SharedTimersPanel';

const useSWRMock = vi.fn();

vi.mock('swr', () => ({
  __esModule: true,
  default: function useSWR(...args: unknown[]) {
    return useSWRMock(...args);
  }
}));

vi.mock('@ui/components/DashboardPanel', () => ({
  DashboardPanel: ({
    title,
    headerRight,
    children
  }: {
    title: string;
    headerRight?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {headerRight}
      <div>{children}</div>
    </section>
  )
}));

vi.mock('@ui/components/SecondaryButton', () => ({
  SecondaryButton: ({
    children,
    disabled
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  )
}));

describe('SharedTimersPanel', () => {
  beforeEach(() => {
    useSWRMock.mockReset();
    useSWRMock.mockReturnValue({
      data: { items: [], serverNow: new Date().toISOString() },
      error: undefined,
      mutate: vi.fn()
    });
  });

  test('does not fetch timers when rendered in read only mode', () => {
    render(<SharedTimersPanel readOnly />);

    expect(useSWRMock).toHaveBeenCalledWith(
      null,
      expect.any(Function),
      expect.objectContaining({ revalidateOnFocus: false })
    );
    expect(screen.getByRole('button', { name: 'Admin sign in to start timers' })).toBeDisabled();
  });
});
