// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DocsSidebar } from './DocsSidebar';

describe('DocsSidebar', () => {
  test('renders core links and caps endpoint previews at eight items', () => {
    render(
      <DocsSidebar
        groups={[
          {
            name: 'Glucose',
            endpoints: Array.from({ length: 10 }, (_, index) => ({
              id: `endpoint-${index}`,
              method: 'GET',
              path: `/api/${index}`,
            })),
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /GET \/api\// })).toHaveLength(8);
  });
});
