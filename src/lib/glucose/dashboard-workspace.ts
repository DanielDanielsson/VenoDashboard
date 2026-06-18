import {
  createDashboardGlucoseService,
  type DashboardGlucoseServiceDeps
} from '@/lib/glucose/dashboard-service';
import type { GlucoseApiResponse, GlucoseUpdatesResponse } from '@/lib/glucose/types';
import {
  venoApiHealthPort,
  venoApiNotesPort,
  venoApiTandemPort,
  venoApiGlucosePort,
  venoApiWorkoutPort
} from '@/lib/glucose/dashboard-service';
import type { TimeRange } from '@/lib/glucose/time-ranges';
import { updateGlucoseCorrections } from '@/lib/veno-api/glucose';
import type { GlucoseCorrectionBatchPayload, GlucoseCorrectionBatchResponse } from '@/lib/veno-api/types';

export type OpenDashboardGlucoseInput =
  | {
      range: TimeRange;
      maxDataPoints?: number | null;
      now?: Date;
    }
  | {
      window: {
        from: string;
        to: string;
      };
      maxDataPoints?: number | null;
      now?: Date;
    };

export interface DashboardGlucoseSession {
  snapshot: GlucoseApiResponse;
  refresh(): Promise<DashboardGlucoseSession>;
  applyCorrections(input: GlucoseCorrectionBatchPayload): Promise<DashboardGlucoseSession>;
}

export interface DashboardGlucoseWorkspace {
  open(input: OpenDashboardGlucoseInput): Promise<DashboardGlucoseSession>;
  getUpdatesSince(since: string, now?: Date): Promise<GlucoseUpdatesResponse>;
  applyCorrections(input: GlucoseCorrectionBatchPayload): Promise<GlucoseCorrectionBatchResponse>;
}

export interface GlucoseCorrectionsPort {
  apply(payload: GlucoseCorrectionBatchPayload): Promise<GlucoseCorrectionBatchResponse>;
}

export interface DashboardGlucoseWorkspaceDeps extends DashboardGlucoseServiceDeps {
  correctionsPort: GlucoseCorrectionsPort;
}

export function createDashboardGlucoseWorkspace(
  deps: DashboardGlucoseWorkspaceDeps
): DashboardGlucoseWorkspace {
  const service = createDashboardGlucoseService(deps);

  function toHistoryInput(input: OpenDashboardGlucoseInput) {
    if ('range' in input) {
      return {
        range: input.range,
        maxDataPoints: input.maxDataPoints,
        now: input.now
      };
    }

    return {
      from: input.window.from,
      to: input.window.to,
      maxDataPoints: input.maxDataPoints,
      now: input.now
    };
  }

  async function createSession(input: OpenDashboardGlucoseInput): Promise<DashboardGlucoseSession> {
    const snapshot = await service.getHistory(toHistoryInput(input));

    return {
      snapshot,
      async refresh() {
        const since = snapshot.meta.timelineRevision ?? snapshot.latest?.timestamp ?? snapshot.meta.to;
        const updates = await service.getUpdatesSince(since, input.now ?? deps.clock?.() ?? new Date());

        if (updates.meta.newCount <= 0) {
          return this;
        }

        return createSession(input);
      },
      async applyCorrections(correctionInput) {
        await deps.correctionsPort.apply(correctionInput);

        return createSession(input);
      }
    };
  }

  return {
    async open(input) {
      return createSession(input);
    },
    async getUpdatesSince(since, now) {
      return service.getUpdatesSince(since, now);
    },
    async applyCorrections(input) {
      return deps.correctionsPort.apply(input);
    }
  };
}

export const dashboardGlucoseWorkspace = createDashboardGlucoseWorkspace({
  glucosePort: venoApiGlucosePort,
  tandemPort: venoApiTandemPort,
  healthPort: venoApiHealthPort,
  workoutPort: venoApiWorkoutPort,
  notesPort: venoApiNotesPort,
  correctionsPort: {
    apply: updateGlucoseCorrections
  }
});
