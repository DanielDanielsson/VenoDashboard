'use client';

import { useMemo, type ReactElement } from 'react';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import {
  RichTextContent,
  RichTextEditor,
  createRichTextDocument,
  normalizeRichTextDocument,
  type RichTextDocument,
} from '@ui/components/RichTextEditor';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';

export type TextPanelSettings = {
  content: RichTextDocument;
};

interface TextPanelProps {
  panelId: string;
  title?: string;
}

const DEFAULT_TEXT_PANEL_SETTINGS: TextPanelSettings = {
  content: createRichTextDocument('Add descriptive text for this dashboard.'),
};

function normalizeTextPanelSettings(value: unknown): TextPanelSettings {
  const content = value && typeof value === 'object' && 'content' in value
    ? (value as { content?: unknown }).content
    : undefined;

  return {
    content: normalizeRichTextDocument(content),
  };
}

export function createTextPanelSettingsRegistration(): DashboardPanelSettingsRegistration<TextPanelSettings> {
  return {
    defaultSettings: DEFAULT_TEXT_PANEL_SETTINGS,
    render: ({ settings, updateSettings }) => {
      const typedSettings = normalizeTextPanelSettings(settings);

      return (
        <RichTextEditor
          value={typedSettings.content}
          onChange={(content) => {
            updateSettings((current) => ({
              ...normalizeTextPanelSettings(current),
              content,
            }));
          }}
          label="Content"
        />
      );
    },
  };
}

export function TextPanel({
  panelId,
  title = 'Text',
}: TextPanelProps): ReactElement {
  const defaultSettings = useMemo(() => DEFAULT_TEXT_PANEL_SETTINGS, []);
  const [settings] = useDashboardPanelSettings(panelId, defaultSettings);
  const normalizedSettings = normalizeTextPanelSettings(settings);

  return (
    <DashboardPanel title={title} twStyles="flex flex-col [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:overflow-y-auto">
      <RichTextContent value={normalizedSettings.content} />
    </DashboardPanel>
  );
}
