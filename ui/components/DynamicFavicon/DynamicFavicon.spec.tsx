// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DynamicFavicon } from './DynamicFavicon';

describe('DynamicFavicon', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latest: {
          valueMmolL: 6.1,
          timestamp: '2026-03-25T12:00:00.000Z',
        },
      }),
    }));

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      set fillStyle(_: string) {},
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,test');
    document.head.innerHTML = '';
  });

  test('creates or updates the favicon from the latest glucose reading', async () => {
    render(<DynamicFavicon />);

    await waitFor(() => {
      const favicon = document.querySelector('link[rel="icon"]');
      expect(favicon).toHaveAttribute('href', 'data:image/png;base64,test');
    });
  });
});
