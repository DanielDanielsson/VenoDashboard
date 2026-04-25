// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LineChart } from './LineChart';

describe('LineChart', () => {
  test('renders a generic line chart with axis labels', () => {
    render(
      <LineChart
        ariaLabel="Workout intensity trend"
        data={[
          { id: '1', x: 0, y: 4 },
          { id: '2', x: 1, y: 6 },
          { id: '3', x: 2, y: 5 },
        ]}
        xTicks={[
          { value: 0, label: 'Mon' },
          { value: 1, label: 'Tue' },
          { value: 2, label: 'Wed' },
        ]}
        yTicks={[
          { value: 4, label: '4' },
          { value: 5, label: '5' },
          { value: 6, label: '6' },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: 'Workout intensity trend' })).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
