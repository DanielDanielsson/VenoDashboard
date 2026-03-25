// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ContractBanner } from './ContractBanner';

describe('ContractBanner', () => {
  test('renders the stale contract fallback copy', () => {
    render(<ContractBanner lastUpdated="2026-03-25T00:00:00.000Z" stale />);

    expect(screen.getByText(/Using bundled snapshot/i)).toBeInTheDocument();
    expect(screen.getByText('2026-03-25T00:00:00.000Z')).toBeInTheDocument();
  });
});
