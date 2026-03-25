// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.add('theme-dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('theme-dark');
    document.documentElement.style.colorScheme = '';
  });

  test('toggles to light theme and persists the selection', () => {
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem('pulse-theme')).toBe('light');
  });
});
