'use client';

import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import { DashboardTimeRangePicker } from '@ui/components/DashboardTimeRangePicker';
import { TextInput } from '@ui/components/TextInput';
import {
  WysiwygEditor,
  type WysiwygDocument,
} from '@ui/components/WysiwygEditor';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import { DASHBOARD_ICON_OPTIONS } from '@/lib/dashboard/metadata';
import type { HistorySelection } from '@/lib/glucose/history-cache';

const DASHBOARD_TYPE_OPTIONS = [
  {
    value: 'timeRange',
    label: 'Time range',
    icon: 'clock',
    description: 'Historical dashboard for glucose timelines, AGP, time in range, and period based panels.',
  },
  {
    value: 'live',
    label: 'Live',
    icon: 'glucose',
    description: 'Realtime dashboard for current glucose, timers, connections, and freshness panels.',
  },
] as const satisfies readonly {
  value: DashboardLibraryItem['type'];
  label: string;
  icon: 'clock' | 'glucose';
  description: string;
}[];

interface DashboardSettingsFormProps {
  ariaLabel: string;
  title: string;
  description: WysiwygDocument;
  icon: DashboardLibraryItem['icon'];
  defaultTimeRange: DashboardLibraryItem['defaultTimeRange'];
  dashboardType: DashboardLibraryItem['type'];
  children: ReactNode;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: WysiwygDocument) => void;
  onIconChange: (icon: DashboardLibraryItem['icon']) => void;
  onDefaultTimeRangeChange: (defaultTimeRange: DashboardLibraryItem['defaultTimeRange']) => void;
  onDashboardTypeChange?: (dashboardType: DashboardLibraryItem['type']) => void;
  twStyles?: string;
}

export const DashboardSettingsForm = ({
  ariaLabel,
  title,
  description,
  icon,
  defaultTimeRange,
  dashboardType,
  children,
  onTitleChange,
  onDescriptionChange,
  onIconChange,
  onDefaultTimeRangeChange,
  onDashboardTypeChange,
  twStyles,
}: DashboardSettingsFormProps) => {
  const handleDefaultTimeRangeChange = (selection: HistorySelection) => {
    if (selection.kind === 'preset') {
      onDefaultTimeRangeChange(selection.range);
    }
  };

  return (
    <section
      aria-label={ariaLabel}
      className={twMerge('grid gap-6 bg-dashboard-panel-bg p-5', twStyles)}
    >
      {onDashboardTypeChange ? (
        <fieldset className="grid gap-2">
          <legend className="ui_micro_label text-text-soft">Dashboard type</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {DASHBOARD_TYPE_OPTIONS.map((option) => {
              const isSelected = dashboardType === option.value;

              return (
                <Button
                  ariaLabel={`Select ${option.label} dashboard type`}
                  aria-pressed={isSelected}
                  key={option.value}
                  twStyles={twMerge(
                    'grid min-h-28 gap-2 rounded-[5px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg p-4 text-left text-dashboard-time-picker-text-muted transition-colors hover:border-text-soft hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text',
                    isSelected && 'border-accent bg-accent-soft text-accent hover:border-accent hover:text-accent',
                  )}
                  onClick={() => onDashboardTypeChange(option.value)}
                >
                  <span className="flex items-center gap-3">
                    <Icon icon={option.icon} twStyles="h-6 w-6 flex-none" />
                    <span className="body_text_strong text-current">{option.label}</span>
                  </span>
                  <span className="body_text text-text-soft">{option.description}</span>
                </Button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <TextInput
            label="Dashboard name"
            value={title}
            onChange={onTitleChange}
          />
          <WysiwygEditor
            label="Description"
            value={description}
            onChange={onDescriptionChange}
          />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="ui_micro_label text-text-soft">Icon</span>
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
              {DASHBOARD_ICON_OPTIONS.map((option) => {
                const isSelected = icon === option.value;

                return (
                  <Button
                    ariaLabel={option.label}
                    aria-pressed={isSelected}
                    key={option.value}
                    title={option.label}
                    twStyles={twMerge(
                      'grid h-12 place-items-center rounded-[5px] border border-dashboard-time-picker-border bg-dashboard-time-picker-bg text-dashboard-time-picker-text-muted transition-colors hover:border-text-soft hover:bg-dashboard-time-picker-bg-hover hover:text-dashboard-time-picker-text',
                      isSelected && 'border-accent bg-accent-soft text-accent hover:border-accent hover:text-accent',
                    )}
                    onClick={() => onIconChange(option.value)}
                  >
                    <Icon icon={option.value} twStyles="h-5 w-5" />
                  </Button>
                );
              })}
            </div>
          </div>
          {dashboardType === 'timeRange' ? (
            <div className="grid gap-2">
              <span className="ui_micro_label text-text-soft">Default time range</span>
              <DashboardTimeRangePicker
                selection={{ kind: 'preset', range: defaultTimeRange ?? '3d' }}
                currentWindow={null}
                timeZone="UTC"
                presetOnly
                onChange={handleDefaultTimeRangeChange}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashboard-panel-border pt-5">
        {children}
      </div>
    </section>
  );
};
