// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DialogPanel } from './DialogPanel';

describe('DialogPanel', () => {
  test('renders dialog semantics without dashboard panel chrome', () => {
    render(
      <DialogPanel title="Workout details">
        <p>Body</p>
      </DialogPanel>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Workout details' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(dialog.querySelector('.dashboard-panel-drag-handle')).toBeNull();
  });
});
