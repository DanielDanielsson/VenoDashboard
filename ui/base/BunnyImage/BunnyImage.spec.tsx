// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { BunnyImage } from './BunnyImage';

describe('BunnyImage', () => {
  test('builds an optimized Bunny CDN image url', () => {
    render(<BunnyImage alt="Portrait" imageName="cv1.jpg" width={400} />);

    const image = screen.getByRole('img', { name: 'Portrait' });
    expect(image).toHaveAttribute('src', 'https://danielupnorth-switch.b-cdn.net/api/img/cv1.jpg?q=90&fmt=webp&w=400');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  test('wraps the image when responsive sizing is enabled', () => {
    const { container } = render(<BunnyImage alt="Portrait" imageName="cv1.jpg" sizes="100vw" />);

    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.querySelector('div > img[alt=\"Portrait\"]')).toBeInTheDocument();
  });
});
