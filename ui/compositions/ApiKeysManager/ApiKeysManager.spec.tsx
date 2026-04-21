// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { ApiKeysManager } from './ApiKeysManager';

describe('ApiKeysManager', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test('shows a success toast after copying a created API key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'key_123',
          name: 'Nightscout',
          apiKey: 'secret_abc',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'key_123',
              name: 'Nightscout',
              status: 'active',
              createdAt: '2026-04-21T00:00:00.000Z',
              lastUsedAt: null,
              revokedAt: null,
            },
          ],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <NotificationsProvider>
        <ApiKeysManager initialItems={[]} />
      </NotificationsProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText('Client name'), {
      target: { value: 'Nightscout' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    await screen.findByText('Copy this now. The secret is shown once.');

    fireEvent.click(screen.getByRole('button', { name: 'Copy API key' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secret_abc');
    });

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getByText('API key copied').closest('[data-variant="success"]')).toBeInTheDocument();
  });
});
