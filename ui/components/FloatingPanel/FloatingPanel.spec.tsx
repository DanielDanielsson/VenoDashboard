// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { FloatingPanel } from './FloatingPanel';

describe('FloatingPanel', () => {
  test('renders a floating shell without dashboard actions', () => {
    render(
      <FloatingPanel title="Active readings">
        <p>Body</p>
      </FloatingPanel>,
    );

    const heading = screen.getByRole('heading', { name: 'Active readings' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(heading.closest('section')?.querySelector('.dashboard-panel-drag-handle')).toBeNull();
  });
});
