// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  test('renders the sprite reference for the requested icon', () => {
    const { container } = render(<Icon icon="info" title="Info icon" />);

    expect(screen.getByTitle('Info icon')).toBeInTheDocument();
    expect(container.querySelector('use')).toHaveAttribute('href', '/static_assets/iconSprite.svg#info');
  });
});
