// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getGlucoseColor } from '@/lib/glucose/tints';
import {
  createCurrentGlucosePanelSettingsRegistration,
  LiveGlucosePanel,
  type CurrentGlucosePanelSettings,
} from './LiveGlucosePanel';

const badgeProps = vi.fn();

vi.mock('@ui/components/DashboardGlucoseBadge/DashboardGlucoseBadge', () => ({
  DashboardGlucoseBadge: (props: unknown) => {
    badgeProps(props);
    return <div data-testid="glucose-badge" />;
  },
}));

describe('LiveGlucosePanel', () => {
  beforeEach(() => {
    badgeProps.mockClear();
  });

  test('makes the glucose indicator and metadata fill the editable panel body', () => {
    render(<LiveGlucosePanel enableStream={false} />);

    const badgeContainer = screen.getByTestId('glucose-badge').parentElement;
    const panel = screen
      .getByRole('heading', { name: 'Current Glucose' })
      .closest('section');

    expect(panel).toHaveClass('flex', 'min-h-0', 'flex-col');
    expect(badgeContainer).toHaveClass(
      'live-glucose-panel-content',
      'h-full',
      'min-h-0',
      'w-full',
      'min-w-0',
    );
    expect(badgeProps).toHaveBeenCalledWith(
      expect.objectContaining({
        contentAlignment: 'vertical',
        colorMode: 'standard',
        glucoseUnit: 'mmol/L',
        enableStream: false,
        fitToContainer: true,
        metadataVisibility: {
          showUnit: true,
          showUpdated: true,
          showDiff: true,
          showSource: true,
        },
        showDetails: true,
      }),
    );
  });

  test('renders checkbox settings for information labels', () => {
    const registration = createCurrentGlucosePanelSettingsRegistration();
    const updateSettings = vi.fn();
    const settings: CurrentGlucosePanelSettings = {
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    };

    const { container } = render(
      registration.render({
        settings,
        updateSettings,
        isOwner: true,
      }),
    );
    const settingHeadings = Array.from(
      container.querySelectorAll('.ui_micro_label'),
    ).map((element) => element.textContent);

    expect(screen.getByText('Information labels')).toBeInTheDocument();
    expect(screen.getByText('Content alignment')).toBeInTheDocument();
    expect(screen.getByText('Color mode')).toBeInTheDocument();
    expect(settingHeadings.slice(0, 4)).toEqual([
      'Unit',
      'Color mode',
      'Content alignment',
      'Information labels',
    ]);
    expect(screen.getByRole('radiogroup', { name: 'Current glucose unit' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'mmol/l' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'mg/dl' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Standard' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Gradient' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const standardPreviewLines = Array.from(
      screen.getByRole('button', { name: 'Standard' }).querySelectorAll('line'),
    );
    const gradientPreviewLines = Array.from(
      screen.getByRole('button', { name: 'Gradient' }).querySelectorAll('line'),
    );

    expect(standardPreviewLines).toHaveLength(18);
    expect(
      standardPreviewLines.some(
        (line) => line.getAttribute('stroke') === getGlucoseColor(10.5, 'standard'),
      ),
    ).toBe(true);
    expect(
      standardPreviewLines.some(
        (line) => line.getAttribute('stroke') === getGlucoseColor(3.5, 'standard'),
      ),
    ).toBe(true);
    expect(
      gradientPreviewLines.some(
        (line) => line.getAttribute('stroke') === getGlucoseColor(10.5, 'gradient'),
      ),
    ).toBe(true);
    expect(
      gradientPreviewLines.some(
        (line) => line.getAttribute('stroke') === getGlucoseColor(3.5, 'gradient'),
      ),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Gradient' }).querySelectorAll('circle'),
    ).toHaveLength(14);
    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('checkbox', { name: 'Unit' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Updated' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Diff' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Source' })).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Diff' }));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0](settings)).toEqual({
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: false,
      showSource: true,
    });
  });

  test('updates the current glucose content alignment setting', () => {
    const registration = createCurrentGlucosePanelSettingsRegistration();
    const updateSettings = vi.fn();
    const resizeLayoutToAspectRatio = vi.fn();
    const settings: CurrentGlucosePanelSettings = {
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    };

    render(
      registration.render({
        settings,
        updateSettings,
        resizeLayoutToAspectRatio,
        isOwner: true,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0](settings)).toEqual({
      contentAlignment: 'horizontal',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    });
    expect(resizeLayoutToAspectRatio).toHaveBeenCalledWith({
      aspectRatio: 2.1,
      minWidth: 5,
      maxWidth: 8,
      minHeight: 5,
      maxHeight: 10,
    });
  });

  test('updates the current glucose color mode setting', () => {
    const registration = createCurrentGlucosePanelSettingsRegistration();
    const updateSettings = vi.fn();
    const settings: CurrentGlucosePanelSettings = {
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    };

    render(
      registration.render({
        settings,
        updateSettings,
        isOwner: true,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gradient' }));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0](settings)).toEqual({
      contentAlignment: 'vertical',
      colorMode: 'gradient',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    });
  });

  test('updates the current glucose unit setting', () => {
    const registration = createCurrentGlucosePanelSettingsRegistration();
    const updateSettings = vi.fn();
    const settings: CurrentGlucosePanelSettings = {
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    };

    render(
      registration.render({
        settings,
        updateSettings,
        isOwner: true,
      }),
    );

    fireEvent.click(screen.getByRole('radio', { name: 'mg/dl' }));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0](settings)).toEqual({
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mg/dL',
      showUnit: true,
      showUpdated: true,
      showDiff: true,
      showSource: true,
    });
  });

  test('disables content alignment when no information labels are enabled', () => {
    const registration = createCurrentGlucosePanelSettingsRegistration();
    const updateSettings = vi.fn();
    const settings: CurrentGlucosePanelSettings = {
      contentAlignment: 'vertical',
      colorMode: 'standard',
      unit: 'mmol/L',
      showUnit: false,
      showUpdated: false,
      showDiff: false,
      showSource: false,
    };

    render(
      registration.render({
        settings,
        updateSettings,
        isOwner: true,
      }),
    );

    expect(screen.getByRole('button', { name: 'Vertical' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Horizontal' })).toBeDisabled();
    const warning = screen.getByText('No information data available to align with.');

    expect(warning).toHaveClass('text-error');
    expect(warning.compareDocumentPosition(screen.getByRole('button', { name: 'Vertical' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
