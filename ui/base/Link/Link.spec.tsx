// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Link } from './Link';

describe('Link', () => {
  test('renders an anchor with merged classes', () => {
    render(
      <Link href="/dashboard" className="base-class" twStyles="extra-class">
        Dashboard
      </Link>,
    );

    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(link).toHaveClass('base-class');
    expect(link).toHaveClass('extra-class');
  });
});
