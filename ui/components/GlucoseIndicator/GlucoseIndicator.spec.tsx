// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { getGlucoseColor } from '@/lib/glucose/tints';
import { GlucoseIndicator } from './GlucoseIndicator';

describe('GlucoseIndicator', () => {
  test('shows stale placeholder when the reading is too old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:20:00.000Z'));

    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        timestamp="2026-03-25T12:00:00.000Z"
      />,
    );

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('20m ago')).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('uses container sized dimensions when fit mode is enabled', () => {
    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        fitToContainer
        showAge={false}
      />,
    );

    const value = screen.getByText('5.4');
    const indicatorFrame = value.parentElement;
    const root = indicatorFrame?.parentElement?.parentElement;

    expect(root).toHaveStyle({
      height: '100%',
      overflow: 'hidden',
      width: '100%',
      placeItems: 'center',
    });
    expect(indicatorFrame).toHaveStyle({
      height: 'var(--glucose-indicator-size)',
      width: 'var(--glucose-indicator-size)',
    });
    expect(root).toHaveStyle({
      '--glucose-indicator-size':
        'clamp(4rem, min(72cqw, calc((100cqh - 1.35rem) * 0.84)), 40rem)',
      '--glucose-indicator-value-font-size':
        'clamp(1.1rem, min(15cqw, 16cqh), 10rem)',
      '--glucose-indicator-unit-font-size':
        'clamp(0.58rem, min(4.8cqw, 4.8cqh), 1.8rem)',
    });
    expect(value).toHaveStyle({
      fontSize: 'var(--glucose-indicator-value-font-size)',
      letterSpacing: '0',
    });
  });

  test('can hide its unit for panels that render labeled metadata', () => {
    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        showAge={false}
        showUnit={false}
      />,
    );

    expect(screen.queryByText('mmol/L')).not.toBeInTheDocument();
  });

  test('can render a converted display value while keeping color based on mmol/L', () => {
    render(
      <GlucoseIndicator
        value={5.8}
        trend="stable"
        displayValue="104"
        unit="mg/dL"
        showAge={false}
      />,
    );

    expect(screen.getByText('104')).toBeInTheDocument();
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
  });

  test('uses the glucose timeline gradient color mode when configured', () => {
    document.documentElement.classList.add('theme-dark');

    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        showAge={false}
        colorMode="gradient"
      />,
    );

    const value = screen.getByText('5.4');
    const iconShell = value.parentElement?.firstElementChild;

    expect(iconShell).toHaveStyle({
      color: getGlucoseColor(5.4, 'gradient', 1, true),
    });

    document.documentElement.classList.remove('theme-dark');
  });

  test('uses more of the container when fit mode has no inline labels', () => {
    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        fitToContainer
        showAge={false}
        showUnit={false}
      />,
    );

    const value = screen.getByText('5.4');
    const root = value.parentElement?.parentElement?.parentElement;

    expect(root).toHaveStyle({
      '--glucose-indicator-size': 'clamp(4rem, min(92cqw, 92cqh), 40rem)',
      '--glucose-indicator-value-font-size':
        'clamp(1.1rem, min(18cqw, 19cqh), 10rem)',
    });
  });

  test('can place fit content against the inline start edge', () => {
    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        fitToContainer
        fitPlacement="center start"
        showAge={false}
      />,
    );

    const value = screen.getByText('5.4');
    const indicatorFrame = value.parentElement;
    const root = indicatorFrame?.parentElement?.parentElement;

    expect(root).toHaveStyle({
      placeItems: 'center start',
    });
  });
});
