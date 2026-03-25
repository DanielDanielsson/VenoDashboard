// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CodeTabs } from './CodeTabs';

describe('CodeTabs', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test('switches tabs and copies the active snippet', async () => {
    render(<CodeTabs curl="curl cmd" javascript="js code" python="py code" />);

    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('py code');
    });
    expect(screen.getByText('py code')).toBeInTheDocument();
  });
});
