// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { NotificationsProvider, useNotifications } from './NotificationsProvider';

function TriggerNotification() {
  const { notify } = useNotifications();

  return (
    <button
      type="button"
      onClick={() =>
        notify('Profile updated', {
          message: 'Changes are now visible across the dashboard.',
        })}
    >
      Show notification
    </button>
  );
}

function TriggerVariantNotifications() {
  const { notifySuccess, notifyWarning, notifyError } = useNotifications();

  return (
    <>
      <button type="button" onClick={() => notifySuccess('Saved successfully')}>
        Show success
      </button>
      <button type="button" onClick={() => notifyWarning('Check your values')}>
        Show warning
      </button>
      <button type="button" onClick={() => notifyError('Save failed')}>
        Show error
      </button>
    </>
  );
}

function TriggerTimedNeutralNotification() {
  const { notify } = useNotifications();

  return (
    <button
      type="button"
      onClick={() =>
        notify('Temporary info', {
          durationMs: 1000,
        })}
    >
      Show timed neutral
    </button>
  );
}

function TriggerDuplicateNotifications() {
  const { notifyError } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => {
        notifyError('Repeated problem', {
          message: 'This should appear as a new toast every time.',
        });
        notifyError('Repeated problem', {
          message: 'This should appear as a new toast every time.',
        });
      }}
    >
      Show duplicates
    </button>
  );
}

function TriggerQueuedNotifications() {
  const { notify } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => {
        for (let index = 1; index <= 6; index += 1) {
          notify(`Queued notification ${index}`, {
            durationMs: 60000,
          });
        }
      }}
    >
      Show queued notifications
    </button>
  );
}

describe('NotificationsProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  test('renders a notification when a child calls notify', () => {
    render(
      <NotificationsProvider>
        <TriggerNotification />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));

    expect(screen.getByText('Profile updated')).toBeInTheDocument();
    expect(screen.getByText('Changes are now visible across the dashboard.')).toBeInTheDocument();
  });

  test('anchors notifications to the bottom right and stacks new items upward', () => {
    render(
      <NotificationsProvider>
        <TriggerDuplicateNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show duplicates' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(viewport).toHaveClass('right-4');
    expect(viewport).toHaveClass('bottom-4');
    expect(viewport).toHaveClass('flex-col-reverse');
    expect(viewport).not.toHaveClass('top-4');
  });

  test('uses the Tailwind z-index token namespace for the notification layer', () => {
    const zIndexesCss = readFileSync(resolve(process.cwd(), 'src/styles/config/z-indexes.css'), 'utf8');

    expect(zIndexesCss).toContain('--z-index-notifications:');
    expect(zIndexesCss).not.toContain('--z-notifications:');
  });

  test('renders notifications with their helper-specific variants', () => {
    render(
      <NotificationsProvider>
        <TriggerVariantNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show warning' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show error' }));

    expect(screen.getByText('Saved successfully').closest('[data-variant="success"]')).toBeInTheDocument();
    expect(screen.getByText('Check your values').closest('[data-variant="warning"]')).toBeInTheDocument();
    expect(screen.getByText('Save failed').closest('[data-variant="error"]')).toBeInTheDocument();
  });

  test('omits the notification body when no message is provided', () => {
    render(
      <NotificationsProvider>
        <TriggerVariantNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));

    const notification = screen.getByText('Saved successfully').closest('article');
    expect(notification).not.toBeNull();
    expect(within(notification!).queryByText(/Changes are now visible across the dashboard\./)).not.toBeInTheDocument();
    expect(within(notification!).queryByText(/Temporary info/)).not.toBeInTheDocument();
    expect(notification?.querySelector('p')).toBeNull();
  });

  test('shows repeated identical notifications as separate toasts', () => {
    render(
      <NotificationsProvider>
        <TriggerDuplicateNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show duplicates' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getAllByText('Repeated problem')).toHaveLength(2);
    expect(within(viewport).getAllByText('This should appear as a new toast every time.')).toHaveLength(2);
    expect(within(viewport).getAllByRole('article')).toHaveLength(2);
  });

  test('dismisses a notification when its close button is clicked', async () => {
    render(
      <NotificationsProvider>
        <TriggerNotification />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close notification: Profile updated' }));

    await waitFor(() => {
      expect(screen.queryByText('Profile updated')).not.toBeInTheDocument();
      expect(screen.queryByText('Changes are now visible across the dashboard.')).not.toBeInTheDocument();
    });
  });

  test('auto-dismisses notifications using default durations and explicit overrides', async () => {
    vi.useFakeTimers();

    render(
      <NotificationsProvider>
        <TriggerVariantNotifications />
        <TriggerTimedNeutralNotification />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show timed neutral' }));

    await act(async () => {
      vi.advanceTimersByTime(1001);
      await Promise.resolve();
    });

    expect(screen.queryByText('Temporary info')).not.toBeInTheDocument();
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2999);
      await Promise.resolve();
    });

    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });

  test('shows at most five visible notifications and reveals queued items in fifo order', async () => {
    render(
      <NotificationsProvider>
        <TriggerQueuedNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show queued notifications' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getAllByRole('article')).toHaveLength(5);
    expect(within(viewport).queryByText('Queued notification 6')).not.toBeInTheDocument();
    expect(within(viewport).getByText('Queued notification 5')).toBeInTheDocument();
    expect(within(viewport).getByText('Queued notification 1')).toBeInTheDocument();

    fireEvent.click(within(viewport).getByRole('button', { name: 'Close notification: Queued notification 5' }));

    await waitForElementToBeRemoved(() => within(viewport).getByText('Queued notification 5'));
    expect(within(viewport).getAllByRole('article')).toHaveLength(5);
    expect(within(viewport).getByText('Queued notification 6')).toBeInTheDocument();
  });

  test('waits for the exit window before promoting queued notifications', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'development');

    render(
      <NotificationsProvider>
        <TriggerQueuedNotifications />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show queued notifications' }));

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    fireEvent.click(within(viewport).getByRole('button', { name: 'Close notification: Queued notification 5' }));

    expect(within(viewport).queryByText('Queued notification 6')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(219);
      await Promise.resolve();
    });

    expect(within(viewport).queryByText('Queued notification 6')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(within(viewport).getByText('Queued notification 6')).toBeInTheDocument();
  });

  test('pauses auto-dismiss while a notification is hovered and resumes on mouse leave', async () => {
    vi.useFakeTimers();

    render(
      <NotificationsProvider>
        <TriggerTimedNeutralNotification />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show timed neutral' }));

    const notification = screen.getByText('Temporary info').closest('article');
    expect(notification).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    fireEvent.mouseEnter(notification!);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(screen.getByText('Temporary info')).toBeInTheDocument();

    fireEvent.mouseLeave(notification!);

    await act(async () => {
      vi.advanceTimersByTime(501);
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(screen.queryByText('Temporary info')).not.toBeInTheDocument();
  });

  test('uses fade-only motion when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })));

    render(
      <NotificationsProvider>
        <TriggerNotification />
      </NotificationsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));

    expect(screen.getByText('Profile updated').closest('[data-motion="fade"]')).toBeInTheDocument();
  });
});
