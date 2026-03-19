export interface PulseApiReading {
  timestamp: string;
  valueMmolL: number;
  valueMgDl: number;
  trend: string;
  status?: string;
  source?: string;
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
