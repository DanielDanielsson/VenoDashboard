// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Grid } from './Grid';

describe('Grid', () => {
  test('renders the requested tag with the base grid classes', () => {
    const { container } = render(
      <Grid as="section" twStyles="custom-grid">
        <div>Content</div>
      </Grid>,
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('grid');
    expect(section).toHaveClass('grid-cols-24');
    expect(section).toHaveClass('custom-grid');
  });
});
