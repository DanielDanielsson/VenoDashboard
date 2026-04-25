// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PieChart } from './PieChart';

const pieData = [
  { id: 'in-range', label: 'In range', value: 70, color: 'var(--color-base-accent-bright)' },
  { id: 'high', label: 'High', value: 20, color: 'var(--color-base-glucose-high-dark)' },
  { id: 'low', label: 'Low', value: 10, color: 'var(--color-base-error-dark)' },
];

describe('PieChart', () => {
  test('renders legend labels and formatted values', () => {
    render(
      <PieChart
        ariaLabel="Time in range distribution"
        data={pieData}
        centerValue="70%"
        centerLabel="In range"
        formatValue={(slice) => `${slice.value}%`}
      />,
    );

    expect(screen.getByRole('img', { name: 'Time in range distribution' })).toBeInTheDocument();
    expect(screen.getAllByText('In range')).toHaveLength(2);
    expect(screen.getAllByText('70%')).toHaveLength(2);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  test('supports interactive legend clicks', () => {
    const handleSliceClick = vi.fn();

    render(
      <PieChart
        ariaLabel="Workout type distribution"
        data={pieData}
        onSliceClick={handleSliceClick}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'High: 20' })[1]!);

    expect(handleSliceClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'high', value: 20 }));
  });
});
