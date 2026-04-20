// @vitest-environment jsdom
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DashboardGridPanel } from './DashboardGridPanel';

describe('DashboardGridPanel', () => {
  test('forwards grid layout props to the underlying element', () => {
    const ref = createRef<HTMLDivElement>();

    render(
      <DashboardGridPanel
        ref={ref}
        panelId="panel-current-glucose"
        title="Current Glucose"
        className="react-grid-item"
        style={{ transform: 'translate(12px, 24px)' }}
      >
        Panel content
      </DashboardGridPanel>,
    );

    const panel = screen.getByText('Panel content');
    expect(panel).toHaveClass('react-grid-item');
    expect(panel).toHaveClass('h-full');
    expect(panel).toHaveStyle({ transform: 'translate(12px, 24px)' });
    expect(ref.current).toBe(panel);
  });
});
