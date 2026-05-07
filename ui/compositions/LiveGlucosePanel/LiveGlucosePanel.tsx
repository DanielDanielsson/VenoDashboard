import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  GLUCOSE_COLOR_MODES,
  getGlucoseColor,
  type GlucoseColorMode,
} from '@/lib/glucose/tints';
import { GLUCOSE_UNITS, type GlucoseUnit } from '@/lib/glucose/units';
import { Checkbox } from '@ui/base/Checkbox';
import { Icon } from '@ui/base/Icon';
import { SegmentedSelector } from '@ui/base/SegmentedSelector';
import { AlignmentOptionButton } from '@ui/components/AlignmentOptionButton';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { DashboardGlucoseBadge } from '@ui/components/DashboardGlucoseBadge/DashboardGlucoseBadge';
import {
  useDashboardPanelSettings,
  type DashboardPanelSettingsRegistration,
} from '@ui/compositions/DashboardGrid';
import './liveGlucosePanel.css';
import type {
  LiveGlucosePanelProps,
  LiveGlucosePanelTheme,
} from './LiveGlucosePanel.types';

const THEME_CLASS: Record<LiveGlucosePanelTheme, string> = {
  light: 'theme-live-glucose-panel-light',
  dark: 'theme-live-glucose-panel-dark',
};

const CURRENT_GLUCOSE_PANEL_ID = 'panel-current-glucose';
export type CurrentGlucoseContentAlignment = 'horizontal' | 'vertical';
export type CurrentGlucoseColorMode = GlucoseColorMode;

export type CurrentGlucosePanelSettings = {
  contentAlignment: CurrentGlucoseContentAlignment;
  colorMode: CurrentGlucoseColorMode;
  unit: GlucoseUnit;
  showUnit: boolean;
  showUpdated: boolean;
  showDiff: boolean;
  showSource: boolean;
};

const DEFAULT_CURRENT_GLUCOSE_PANEL_SETTINGS: CurrentGlucosePanelSettings = {
  contentAlignment: 'vertical',
  colorMode: 'standard',
  unit: 'mmol/L',
  showUnit: true,
  showUpdated: true,
  showDiff: true,
  showSource: true,
};

const CURRENT_GLUCOSE_METADATA_OPTIONS = [
  { key: 'showUnit', label: 'Unit' },
  { key: 'showUpdated', label: 'Updated' },
  { key: 'showDiff', label: 'Diff' },
  { key: 'showSource', label: 'Source' },
] satisfies Array<{ key: keyof CurrentGlucosePanelSettings; label: string }>;

const CURRENT_GLUCOSE_ALIGNMENT_OPTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
] satisfies Array<{ value: CurrentGlucoseContentAlignment; label: string }>;
const CURRENT_GLUCOSE_ALIGNMENT_LAYOUT = {
  vertical: {
    aspectRatio: 1.35,
    minWidth: 4,
    maxWidth: 6,
    minHeight: 6,
    maxHeight: 12,
  },
  horizontal: {
    aspectRatio: 2.1,
    minWidth: 5,
    maxWidth: 8,
    minHeight: 5,
    maxHeight: 10,
  },
} satisfies Record<CurrentGlucoseContentAlignment, {
  aspectRatio: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}>;

const INFORMATION_PREVIEW_LINES = [
  { x2: 50, y: 5 },
  { x2: 42, y: 12 },
  { x2: 46, y: 19 },
] as const;

const COLOR_MODE_PREVIEW_POINTS = [
  { x: 0, y: 68 },
  { x: 14, y: 70 },
  { x: 28, y: 74 },
  { x: 42, y: 82 },
  { x: 56, y: 72 },
  { x: 70, y: 50 },
  { x: 84, y: 28 },
  { x: 98, y: 28 },
  { x: 112, y: 31 },
  { x: 126, y: 17 },
  { x: 140, y: 4 },
  { x: 154, y: 2 },
  { x: 168, y: 14 },
  { x: 182, y: 22 },
] as const;

type ColorModePreviewPoint = {
  x: number;
  y: number;
};

const COLOR_MODE_PREVIEW_HIGH_Y = 28;
const COLOR_MODE_PREVIEW_LOW_Y = 76;
const COLOR_MODE_PREVIEW_HIGH_VALUE = 10;
const COLOR_MODE_PREVIEW_LOW_VALUE = 4;
const COLOR_MODE_PREVIEW_BOUNDARIES = [
  COLOR_MODE_PREVIEW_HIGH_Y,
  COLOR_MODE_PREVIEW_LOW_Y,
] as const;

function getColorModePreviewValue(y: number): number {
  const valuePerPixel =
    (COLOR_MODE_PREVIEW_HIGH_VALUE - COLOR_MODE_PREVIEW_LOW_VALUE) /
    (COLOR_MODE_PREVIEW_LOW_Y - COLOR_MODE_PREVIEW_HIGH_Y);

  return (
    COLOR_MODE_PREVIEW_HIGH_VALUE +
    (COLOR_MODE_PREVIEW_HIGH_Y - y) * valuePerPixel
  );
}

function interpolatePreviewPoint(
  start: ColorModePreviewPoint,
  end: ColorModePreviewPoint,
  y: number,
): ColorModePreviewPoint {
  const ratio = (y - start.y) / (end.y - start.y);

  return {
    x: start.x + (end.x - start.x) * ratio,
    y,
  };
}

function splitColorModePreviewSegment(
  start: ColorModePreviewPoint,
  end: ColorModePreviewPoint,
): Array<[ColorModePreviewPoint, ColorModePreviewPoint]> {
  const splitPoints = [
    start,
    ...COLOR_MODE_PREVIEW_BOUNDARIES
      .filter((boundaryY) => {
        const startsAboveBoundary = start.y < boundaryY;
        const endsAboveBoundary = end.y < boundaryY;

        return startsAboveBoundary !== endsAboveBoundary;
      })
      .map((boundaryY) => interpolatePreviewPoint(start, end, boundaryY)),
    end,
  ].sort((left, right) => left.x - right.x);

  return splitPoints.slice(0, -1).map((point, index) => [
    point,
    splitPoints[index + 1],
  ]);
}

function AlignmentPreviewIcon({
  alignment,
}: {
  alignment: CurrentGlucoseContentAlignment;
}): ReactElement {
  const lineBlock = (
    <svg
      aria-hidden
      viewBox="0 0 56 24"
      className="h-6 w-14 text-current"
      fill="none"
    >
      {INFORMATION_PREVIEW_LINES.map((line) => (
        <line
          key={`${line.x2}-${line.y}`}
          x1="6"
          y1={line.y}
          x2={line.x2}
          y2={line.y}
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
  const glucoseIcon = (
    <span className="flex h-8 w-8 items-center justify-center">
      <Icon icon="glucose" size="h-7 w-7" />
    </span>
  );

  return (
    <span
      aria-hidden
      className={twMerge(
        'flex h-full w-full items-center justify-center gap-3 text-text-soft',
        alignment === 'vertical' && 'flex-col gap-2',
      )}
    >
      {lineBlock}
      {glucoseIcon}
    </span>
  );
}

function ColorModePreviewIcon({
  colorMode,
}: {
  colorMode: CurrentGlucoseColorMode;
}): ReactElement {
  return (
    <span
      aria-hidden
      className="flex h-full w-full items-center justify-center"
    >
      <svg viewBox="0 0 184 96" className="h-20 w-full max-w-44">
        <rect x="0" y="0" width="184" height="96" rx="4" fill="rgb(15 23 42 / 0.24)" />
        <rect x="0" y="28" width="184" height="48" fill="rgb(20 184 166 / 0.12)" />
        <line x1="0" y1="28" x2="184" y2="28" stroke="rgb(45 212 191 / 0.42)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1="76" x2="184" y2="76" stroke="rgb(45 212 191 / 0.28)" strokeWidth="1" strokeDasharray="4 4" />
        {COLOR_MODE_PREVIEW_POINTS.slice(0, -1).map((point, index) => {
          const nextPoint = COLOR_MODE_PREVIEW_POINTS[index + 1];

          return splitColorModePreviewSegment(point, nextPoint).map(
            ([segmentStart, segmentEnd]) => {
              const midpointY = (segmentStart.y + segmentEnd.y) / 2;
              const color = getGlucoseColor(
                getColorModePreviewValue(midpointY),
                colorMode,
              );

              return (
                <line
                  key={`${segmentStart.x}-${segmentEnd.x}-${segmentStart.y}-${segmentEnd.y}`}
                  x1={segmentStart.x}
                  y1={segmentStart.y}
                  x2={segmentEnd.x}
                  y2={segmentEnd.y}
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              );
            },
          );
        })}
        {COLOR_MODE_PREVIEW_POINTS.map((point) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r="2.5"
            fill={getGlucoseColor(getColorModePreviewValue(point.y), colorMode)}
          />
        ))}
      </svg>
    </span>
  );
}

export function createCurrentGlucosePanelSettingsRegistration(): DashboardPanelSettingsRegistration {
  return {
    defaultSettings: DEFAULT_CURRENT_GLUCOSE_PANEL_SETTINGS,
    render: ({ settings, updateSettings, resizeLayoutToAspectRatio }) => {
      const typedSettings = settings as CurrentGlucosePanelSettings;
      const updateTypedSettings = updateSettings as (
        updater: (current: CurrentGlucosePanelSettings) => CurrentGlucosePanelSettings
      ) => void;
      const hasInformationLabels = CURRENT_GLUCOSE_METADATA_OPTIONS.some(
        (option) => typedSettings[option.key],
      );

      return (
        <div className="grid gap-6">
          <div className="grid gap-3">
            <span className="ui_micro_label text-text-soft">Unit</span>
            <SegmentedSelector
              ariaLabel="Current glucose unit"
              value={typedSettings.unit}
              options={GLUCOSE_UNITS}
              onChange={(unit) => {
                updateTypedSettings((current) => ({
                  ...current,
                  unit,
                }));
              }}
            />
          </div>

          <div className="grid gap-3">
            <span className="ui_micro_label text-text-soft">Color mode</span>
            <div className="grid grid-cols-2 gap-2">
              {GLUCOSE_COLOR_MODES.map((option) => (
                <AlignmentOptionButton
                  key={option.value}
                  selected={typedSettings.colorMode === option.value}
                  label={option.label}
                  onClick={() => {
                    updateTypedSettings((current) => ({
                      ...current,
                      colorMode: option.value,
                    }));
                  }}
                >
                  <ColorModePreviewIcon colorMode={option.value} />
                </AlignmentOptionButton>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <span className="ui_micro_label text-text-soft">
              Content alignment
            </span>
            {!hasInformationLabels ? (
              <p className="ui_caption text-error">
                No information data available to align with.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {CURRENT_GLUCOSE_ALIGNMENT_OPTIONS.map((option) => (
                <AlignmentOptionButton
                  key={option.value}
                  selected={typedSettings.contentAlignment === option.value}
                  disabled={!hasInformationLabels}
                  label={option.label}
                  onClick={() => {
                    if (typedSettings.contentAlignment === option.value) {
                      return;
                    }

                    updateTypedSettings((current) => ({
                      ...current,
                      contentAlignment: option.value,
                    }));
                    resizeLayoutToAspectRatio?.(CURRENT_GLUCOSE_ALIGNMENT_LAYOUT[option.value]);
                  }}
                >
                  <AlignmentPreviewIcon alignment={option.value} />
                </AlignmentOptionButton>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <span className="ui_micro_label text-text-soft">
              Information labels
            </span>
            <div className="grid gap-2">
              {CURRENT_GLUCOSE_METADATA_OPTIONS.map((option) => (
                <Checkbox
                  key={option.key}
                  label={option.label}
                  checked={typedSettings[option.key]}
                  labelClassName="grid-drag-cancel"
                  onCheckedChange={(checked) => {
                    updateTypedSettings((current) => ({
                      ...current,
                      [option.key]: checked,
                    }));
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    },
  };
}

export const LiveGlucosePanel = ({
  enableStream = true,
  twStyles,
  theme,
}: LiveGlucosePanelProps): ReactElement => {
  const [settings] = useDashboardPanelSettings(
    CURRENT_GLUCOSE_PANEL_ID,
    DEFAULT_CURRENT_GLUCOSE_PANEL_SETTINGS,
  );
  const metadataVisibility = {
    showUnit: settings.showUnit,
    showUpdated: settings.showUpdated,
    showDiff: settings.showDiff,
    showSource: settings.showSource,
  };

  return (
    <DashboardPanel
      title="Current Glucose"
      theme={theme}
      twStyles={twMerge(
        'flex min-h-0 flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1',
        theme && THEME_CLASS[theme],
        twStyles,
      )}
    >
      <div className="live-glucose-panel-content grid h-full min-h-0 w-full min-w-0 place-items-center">
        <DashboardGlucoseBadge
          contentAlignment={settings.contentAlignment}
          colorMode={settings.colorMode}
          enableStream={enableStream}
          fitToContainer
          glucoseUnit={settings.unit}
          metadataVisibility={metadataVisibility}
          showDetails
        />
      </div>
    </DashboardPanel>
  );
};
