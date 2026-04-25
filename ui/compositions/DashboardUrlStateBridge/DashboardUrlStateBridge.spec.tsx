// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';
import { DashboardUrlStateBridge } from './DashboardUrlStateBridge';

const usePathnameMock = vi.fn();
const useSearchParamsMock = vi.fn();
const replaceMock = vi.fn();
const routerMock = { replace: replaceMock };

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => routerMock,
}));

describe('DashboardUrlStateBridge', () => {
  test('rejects unsupported overview time params and shows one invalid url toast', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('from=now-3d&to=now&timezone=browser'));

    render(
      <NotificationsProvider>
        <DashboardUrlStateBridge dashboardTitle="Overview" rejectTimeRange />
      </NotificationsProvider>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });

    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(within(viewport).getAllByText('Invalid URL parameter')).toHaveLength(1);
    expect(within(viewport).getByText('Redirected to Overview')).toBeInTheDocument();
  });

  test('preserves viewPanel while removing unsupported overview time params', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(new URLSearchParams('from=now-3d&to=now&timezone=browser&viewPanel=panel-current-glucose'));

    render(
      <NotificationsProvider>
        <DashboardUrlStateBridge dashboardTitle="Overview" rejectTimeRange />
      </NotificationsProvider>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard?viewPanel=panel-current-glucose');
    });
  });
});
