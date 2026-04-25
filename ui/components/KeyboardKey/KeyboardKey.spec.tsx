// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KeyboardKey } from './KeyboardKey';

describe('KeyboardKey', () => {
  it('renders a semantic keyboard key with themed key styling', () => {
    render(<KeyboardKey>V</KeyboardKey>);

    const key = screen.getByText('V');

    expect(key.tagName).toBe('KBD');
    expect(key).toHaveClass(
      'bg-keyboard-key-bg',
      'border-keyboard-key-border',
      'shadow-keyboard-key',
      'text-keyboard-key-text',
    );
  });
});
