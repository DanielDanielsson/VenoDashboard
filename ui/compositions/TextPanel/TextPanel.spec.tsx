// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { TextPanel, createTextPanelSettingsRegistration, type TextPanelSettings } from './TextPanel';

describe('TextPanel', () => {
  test('renders the default descriptive text', () => {
    render(<TextPanel panelId="panel-text" />);

    expect(screen.getByRole('heading', { name: 'Text' })).toBeInTheDocument();
    expect(screen.getByText('Add descriptive text for this dashboard.')).toBeInTheDocument();
  });

  test('settings editor updates rich text content', () => {
    const registration = createTextPanelSettingsRegistration();
    const updateSettings = vi.fn();

    render(
      registration.render({
        settings: {
          content: {
            blocks: [
              { id: 'one', type: 'paragraph', text: 'Initial' },
            ],
          },
        } satisfies TextPanelSettings,
        updateSettings,
        isOwner: true,
      }),
    );

    fireEvent.change(screen.getByLabelText('Text block 1'), {
      target: { value: 'Edited' },
    });

    const updater = updateSettings.mock.calls.at(-1)?.[0] as ((current: TextPanelSettings) => TextPanelSettings);
    expect(updater({
      content: {
        blocks: [
          { id: 'one', type: 'paragraph', text: 'Initial' },
        ],
      },
    })).toEqual({
      content: {
        blocks: [
          { id: 'one', type: 'paragraph', text: 'Edited' },
        ],
      },
    });
  });
});
