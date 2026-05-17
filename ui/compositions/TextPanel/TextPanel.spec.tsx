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

  test('uses the panel definition title before custom settings exist', () => {
    render(<TextPanel panelId="panel-text" title="Notes" />);

    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
  });

  test('settings editor updates WYSIWYG content', () => {
    const registration = createTextPanelSettingsRegistration();
    const updateSettings = vi.fn();

    render(
      registration.render({
        settings: {
          title: 'Text',
          content: {
            version: 1,
            blocks: [
              { id: 'one', type: 'paragraph', spans: [{ text: 'Initial' }] },
            ],
          },
        } satisfies TextPanelSettings,
        updateSettings,
        isOwner: true,
      }),
    );

    const editor = screen.getByRole('textbox', { name: 'Content' });
    editor.innerHTML = '<div data-wysiwyg-block="" data-wysiwyg-block-type="paragraph">Edited</div>';
    fireEvent.input(editor);

    const updater = updateSettings.mock.calls.at(-1)?.[0] as ((current: TextPanelSettings) => TextPanelSettings);
    expect(updater({
      title: 'Text',
      content: {
        version: 1,
        blocks: [
          { id: 'one', type: 'paragraph', spans: [{ text: 'Initial' }] },
        ],
      },
    })).toEqual({
      title: 'Text',
      content: {
        version: 1,
        blocks: [
          { id: 'one', type: 'paragraph', spans: [{ text: 'Edited' }] },
        ],
      },
    });
  });

  test('settings editor updates the panel title', () => {
    const registration = createTextPanelSettingsRegistration();
    const updateSettings = vi.fn();

    render(
      registration.render({
        settings: {
          title: 'Text',
          content: {
            version: 1,
            blocks: [
              { id: 'one', type: 'paragraph', spans: [{ text: 'Initial' }] },
            ],
          },
        } satisfies TextPanelSettings,
        updateSettings,
        isOwner: true,
      }),
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Dashboard notes' },
    });

    const updater = updateSettings.mock.calls.at(-1)?.[0] as ((current: TextPanelSettings) => TextPanelSettings);
    expect(updater({
      title: 'Text',
      content: {
        version: 1,
        blocks: [
          { id: 'one', type: 'paragraph', spans: [{ text: 'Initial' }] },
        ],
      },
    })).toEqual({
      title: 'Dashboard notes',
      content: {
        version: 1,
        blocks: [
          { id: 'one', type: 'paragraph', spans: [{ text: 'Initial' }] },
        ],
      },
    });
  });

  test('settings updates retain formatted WYSIWYG content in the canonical schema', () => {
    const registration = createTextPanelSettingsRegistration();
    const updateSettings = vi.fn();
    const formattedSettings: TextPanelSettings = {
      title: 'Text',
      content: {
        version: 1,
        blocks: [
          {
            id: 'one',
            type: 'heading',
            spans: [
              { text: 'Important', marks: ['bold', 'underline'] },
            ],
          },
        ],
      },
    };

    render(
      registration.render({
        settings: formattedSettings,
        updateSettings,
        isOwner: true,
      }),
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Copied notes' },
    });

    const updater = updateSettings.mock.calls.at(-1)?.[0] as ((current: TextPanelSettings) => TextPanelSettings);
    expect(updater(formattedSettings)).toEqual({
      title: 'Copied notes',
      content: formattedSettings.content,
    });
  });
});
