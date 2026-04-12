export interface PulseApiReading {
  id?: string;
  timestamp: string;
  valueMmolL: number;
  valueMgDl: number;
  originalValueMmolL?: number | null;
  originalValueMgDl?: number | null;
  isCorrected?: boolean;
  correctionReason?: string | null;
  trend: string;
  status?: string;
  source?: string;
}

export interface GlucoseCorrectionTarget {
  source: 'official' | 'share';
  readingId: string;
  valueMmolL: number | null;
  reason?: string | null;
}

export interface GlucoseCorrectionBatchPayload {
  items: GlucoseCorrectionTarget[];
}

export interface GlucoseCorrectionBatchResponse {
  updated: number;
  cleared: number;
}

export type TimelineNoteAuthorType = 'user' | 'assistant';

export interface TimelineNote {
  id: string;
  text: string;
  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;
  authorType: TimelineNoteAuthorType;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface TimelineNoteListResponse {
  items: TimelineNote[];
  meta: {
    from: string;
    to: string;
    returned: number;
  };
}

export interface TimelineNoteWritePayload {
  text: string;
  timezone: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  authorType?: TimelineNoteAuthorType;
  source?: string | null;
}

export interface TimelineNoteMutationResponse {
  note: TimelineNote;
}

export interface TimelineNoteDeleteResponse {
  deleted: boolean;
  noteId: string;
}

export interface Workout {
  id: string;
  startAt: string;
  endAt: string;
  workoutType: string;
  rawWorkoutType: string | null;
  displayName: string | null;
  sourceSystem: string;
  sourceId: string | null;
  updatedAt?: string;
}

export interface WorkoutWritePayload {
  startAt: string;
  endAt: string;
  workoutType: string;
  displayName?: string | null;
}

export interface WorkoutMutationResponse {
  workout: Workout;
}

export interface WorkoutDeleteResponse {
  deleted: boolean;
  workoutId: string;
}

export interface TimelineUpdatesResponse {
  meta: {
    since: string;
    latestRevision: string | null;
    newCount: number;
  };
}

export interface PulseApiSourceStatus {
  stable: boolean;
  connected: boolean;
  latestReading: PulseApiReading | null;
  sourceToDbLagMinutes: number | null;
  latestReadingAgeMinutes: number | null;
  syncLagMinutes?: number | null;
}

export interface PulseApiStatusReport {
  generatedAt: string;
  official: PulseApiSourceStatus;
  share: PulseApiSourceStatus;
  tandem: PulseApiSourceStatus;
}

export interface AdminHealthStepBucket {
  bucketStart: string;
  bucketEnd: string;
  stepCount: number;
  source: string;
}

export interface AdminHealthStepBucketsResponse {
  items: AdminHealthStepBucket[];
}

export interface AlarmSound {
  id: string;
  name: string;
  url: string;
}

export interface ConsumerProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  timezone: string;
  glucoseUnit: 'mmol/L' | 'mg/dL';
  profileImageUrl: string | null;
  profileImageDataUrl: string | null;
  alarmSounds: AlarmSound[];
  defaultAlarmSoundId: string | null;
  updatedAt: string;
  updatedBy: {
    apiKeyId: string | null;
    apiKeyName: string | null;
  };
}

export interface ConsumerProfileResponse {
  profile: ConsumerProfile;
}

export interface ConsumerProfileUpdatePayload {
  firstName: string;
  lastName: string;
  timezone: string;
  glucoseUnit: 'mmol/L' | 'mg/dL';
  profileImageUrl: string | null;
  profileImageDataUrl: string | null;
  alarmSounds: AlarmSound[];
  defaultAlarmSoundId: string | null;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyListResponse {
  items: ApiKeySummary[];
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  apiKey: string;
}

export interface PulseApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface NotificationEvent<TPayload = unknown> {
  id: string;
  seq: number;
  type: string;
  title: string;
  message: string | null;
  payload: TPayload;
  timestamp: string;
  sender: {
    apiKeyId: string | null;
    apiKeyName: string | null;
  };
}

export interface NotificationProfilePatch {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  timezone?: string | null;
  glucoseUnit?: string | null;
  profileImageUrl?: string | null;
  defaultAlarmSoundId?: string | null;
}

export interface SettingsProfileUpdatedPayload {
  updatedAt?: string | null;
  refetchPath?: string | null;
  profile?: NotificationProfilePatch | null;
}

export interface SharedTimer {
  id: string;
  durationSeconds: number;
  createdAt: string;
  fireAt: string;
  removedAt: string | null;
  createdBy: {
    apiKeyId: string | null;
    apiKeyName: string | null;
  };
}

export interface SharedTimerListResponse {
  items: SharedTimer[];
  serverNow: string;
}

export interface CreateSharedTimerPayload {
  durationSeconds: number;
}

export interface SharedTimerMutationResponse {
  timer: SharedTimer;
  serverNow: string;
}

export interface TimerStartedPayload {
  timer?: SharedTimer | null;
  serverNow?: string | null;
}

export interface TimerRemovedPayload {
  timerId?: string | null;
  serverNow?: string | null;
}

export interface SharedTimerStreamConnectedPayload {
  items: SharedTimer[];
  serverNow: string;
}
