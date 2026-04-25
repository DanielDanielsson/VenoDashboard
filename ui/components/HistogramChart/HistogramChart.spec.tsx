// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { HistogramChart } from './HistogramChart';

describe('HistogramChart', () => {
  test('renders bins and axis labels', () => {
    render(
      <HistogramChart
        ariaLabel="Glucose distribution"
        data={[
          { id: 'low', label: '<4', value: 2 },
          { id: 'in-range', label: '4-10', value: 12 },
          { id: 'high', label: '>10', value: 4 },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: 'Glucose distribution' })).toBeInTheDocument();
    expect(screen.getByText('4-10')).toBeInTheDocument();
    expect(screen.getByLabelText('4-10: 12')).toBeInTheDocument();
  });
});
