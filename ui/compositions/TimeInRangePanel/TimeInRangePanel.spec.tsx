// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { GlucoseStats } from '@/lib/glucose/metrics';
import { TimeInRangePanel } from './TimeInRangePanel';

const stats: GlucoseStats = {
  avg: 7,
  min: 3.8,
  max: 12.2,
  veryLow: { count: 0, percentage: 0 },
  low: { count: 1, percentage: 10 },
  inRange: { count: 7, percentage: 70 },
  high: { count: 2, percentage: 20 },
  veryHigh: { count: 0, percentage: 0 },
};

describe('TimeInRangePanel', () => {
  test('renders the overview layout without local time range controls', () => {
    render(<TimeInRangePanel stats={stats} />);

    expect(screen.queryByRole('button', { name: '24d' })).not.toBeInTheDocument();
    expect(screen.getByText('Very Low')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Time in range distribution' })).toBeInTheDocument();
    expect(screen.getByText('In range')).toBeInTheDocument();
    expect(screen.getAllByText('70%')).toHaveLength(2);
  });

  test('renders the statistics layout when configured', () => {
    render(<TimeInRangePanel defaultLayout="statistics" stats={stats} />);

    expect(screen.queryByRole('button', { name: '24d' })).not.toBeInTheDocument();
    expect(screen.getByText('In range')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
