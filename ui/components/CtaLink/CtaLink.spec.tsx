// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CtaLink } from './CtaLink';

const trackEvent = vi.fn();

vi.mock('@/lib/ui/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe('CtaLink', () => {
  test('tracks analytics when clicked', () => {
    render(<CtaLink href="/dashboard" label="Open dashboard" eventName="cta_click" />);

    fireEvent.click(screen.getByRole('link', { name: 'Open dashboard' }));
    expect(trackEvent).toHaveBeenCalledWith('cta_click', { href: '/dashboard', label: 'Open dashboard' });
  });
});
