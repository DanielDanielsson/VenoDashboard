'use client';

import { useMemo, type ReactElement } from 'react';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import {
  WysiwygContent,
  WysiwygEditor,
  createWysiwygDocument,
  normalizeWysiwygDocument,
  type WysiwygDocument,
} from '@ui/components/WysiwygEditor';
import { TextInput } from '@ui/components/TextInput';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';

export type TextPanelSettings = {
  title: string;
  content: WysiwygDocument;
};

interface TextPanelProps {
  panelId: string;
  title?: string;
}

const DEFAULT_TEXT_PANEL_SETTINGS: TextPanelSettings = {
  title: 'Text',
  content: createWysiwygDocument('Add descriptive text for this dashboard.'),
};

const normalizeTextPanelSettings = (
  value: unknown,
  fallbackTitle = DEFAULT_TEXT_PANEL_SETTINGS.title,
): TextPanelSettings => {
  const record = value && typeof value === 'object'
    ? value as { title?: unknown; content?: unknown }
    : undefined;
  const title = typeof record?.title === 'string'
    ? record.title
    : fallbackTitle;

  return {
    title,
    content: normalizeWysiwygDocument(record?.content),
  };
};

export const createTextPanelSettingsRegistration = (): DashboardPanelSettingsRegistration<TextPanelSettings> => {
  return {
    defaultSettings: DEFAULT_TEXT_PANEL_SETTINGS,
    render: ({ settings, updateSettings }) => {
      const typedSettings = normalizeTextPanelSettings(settings);

      return (
        <div className="grid gap-5">
          <TextInput
            label="Title"
            value={typedSettings.title}
            onChange={(title) => {
              updateSettings((current) => ({
                ...normalizeTextPanelSettings(current),
                title,
              }));
            }}
          />
          <WysiwygEditor
            value={typedSettings.content}
            onChange={(content) => {
              updateSettings((current) => ({
                ...normalizeTextPanelSettings(current),
                content,
              }));
            }}
            label="Content"
          />
        </div>
      );
    },
  };
};

export const TextPanel = ({
  panelId,
  title = 'Text',
}: TextPanelProps): ReactElement => {
  const defaultSettings = useMemo(() => ({
    ...DEFAULT_TEXT_PANEL_SETTINGS,
    title,
  }), [title]);
  const [settings] = useDashboardPanelSettings(panelId, defaultSettings);
  const normalizedSettings = normalizeTextPanelSettings(settings, title);

  return (
    <DashboardPanel title={normalizedSettings.title} twStyles="flex flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col [&>div:last-child]:overflow-hidden">
      <WysiwygContent
        value={normalizedSettings.content}
        showOverflowFade
        twStyles="flex-1"
      />
    </DashboardPanel>
  );
};
