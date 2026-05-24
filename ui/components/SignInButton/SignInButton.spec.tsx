// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SignInButton } from './SignInButton';

describe('SignInButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('keeps submit disabled until credentials are entered', () => {
    render(<SignInButton />);

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  test('closes to a public dashboard when opened from a protected admin page', () => {
    render(<SignInButton callbackUrl="/dashboard/settings" />);

    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/dashboards/overview');
  });

  test('closes to the requested public dashboard route', () => {
    render(<SignInButton callbackUrl="/dashboards/statistics?range=3d" />);

    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/dashboards/statistics?range=3d');
  });

  test('submits credentials and redirects on success', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ callbackUrl: '/dashboard/settings' }),
    });

    render(<SignInButton callbackUrl="/dashboard/settings" />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(screen.queryByText('Invalid username or password.')).not.toBeInTheDocument();
  });

  test('shows the API error when sign in fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid username or password.' } }),
    });

    render(<SignInButton />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument();
  });
});
