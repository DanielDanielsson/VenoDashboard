// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { GlucoseStatRing } from './GlucoseStatRing';

describe('GlucoseStatRing', () => {
  test('clamps the percentage to a valid range', () => {
    render(<GlucoseStatRing label="In range" percentage={132} color="#00ff00" />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('In range')).toBeInTheDocument();
  });
});
