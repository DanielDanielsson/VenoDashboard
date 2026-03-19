'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
/* eslint-disable @next/next/no-img-element */
import type {
  AlarmSound,
  ConsumerProfile,
  ConsumerProfileResponse,
  NotificationEvent,
  SettingsProfileUpdatedPayload
} from '@/lib/pulse-api/types';

interface SettingsFormProps {
  initialProfile: ConsumerProfile;
}

function detectBrowserTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function emptySound(): AlarmSound {
  return { id: '', name: '', url: '' };
}

export function SettingsForm({ initialProfile }: SettingsFormProps) {
  const browserTimeZone = detectBrowserTimeZone();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [selectedImageName, setSelectedImageName] = useState('');
  const [message, setMessage] = useState('Ready');
  const [messageTone, setMessageTone] = useState<'neutral' | 'error' | 'success'>('neutral');
  const [saving, setSaving] = useState(false);

  const previewSrc = profile.profileImageDataUrl || profile.profileImageUrl || '';

  function setField<K extends keyof ConsumerProfile>(field: K, value: ConsumerProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function setSound(index: number, field: keyof AlarmSound, value: string) {
    setProfile((current) => ({
      ...current,
      alarmSounds: current.alarmSounds.map((sound, soundIndex) =>
        soundIndex === index ? { ...sound, [field]: value } : sound
      )
    }));
  }

  function addSound() {
    setProfile((current) => ({
      ...current,
      alarmSounds: [...current.alarmSounds, emptySound()]
    }));
  }

  function removeSound(index: number) {
    setProfile((current) => {
      const nextSounds = current.alarmSounds.filter((_, soundIndex) => soundIndex !== index);
      const defaultAlarmSoundId =
        current.defaultAlarmSoundId && nextSounds.some((sound) => sound.id === current.defaultAlarmSoundId)
          ? current.defaultAlarmSoundId
          : null;

      return {
        ...current,
        alarmSounds: nextSounds,
        defaultAlarmSoundId
      };
    });
  }

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Failed to read image file'));
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  async function onImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 700 * 1024) {
      setMessage('Image is too large. Max size is 700 KB.');
      setMessageTone('error');
      setSelectedImageName('');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile((current) => ({
        ...current,
        profileImageDataUrl: dataUrl,
        profileImageUrl: null
      }));
      setSelectedImageName(file.name);
      setMessage('Image ready to save');
      setMessageTone('neutral');
    } catch (error) {
      setSelectedImageName('');
      setMessage(error instanceof Error ? error.message : 'Failed to read image');
      setMessageTone('error');
    } finally {
      event.target.value = '';
    }
  }

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  async function reload(successMessage = 'Settings reloaded') {
    setMessage('Reloading settings...');
    setMessageTone('neutral');

    const response = await fetch('/api/dashboard/settings/profile', {
      cache: 'no-store',
      headers: {
        'x-user-timezone': browserTimeZone
      }
    });

    const data = (await response.json()) as ConsumerProfileResponse & { error?: { message?: string } };
    if (!response.ok) {
      setMessage(data.error?.message || 'Failed to reload settings');
      setMessageTone('error');
      return;
    }

    setProfile(data.profile);
    setSelectedImageName('');
    setMessage(successMessage);
    setMessageTone('success');
  }

  useEffect(() => {
    setProfile(initialProfile);
    setSelectedImageName('');
  }, [initialProfile]);

  useEffect(() => {
    const reloadLatestSettings = async (successMessage: string) => {
      setMessage('Reloading settings...');
      setMessageTone('neutral');

      const response = await fetch('/api/dashboard/settings/profile', {
        cache: 'no-store',
        headers: {
          'x-user-timezone': browserTimeZone
        }
      });

      const data = (await response.json()) as ConsumerProfileResponse & { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to reload settings');
      }

      setProfile(data.profile);
      setSelectedImageName('');
      setMessage(successMessage);
      setMessageTone('success');
    };

    const handleSettingsUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent<NotificationEvent<SettingsProfileUpdatedPayload>>;
      const payload = customEvent.detail?.payload;
      const message =
        customEvent.detail?.type === 'settings.profile.updated'
          ? 'Profile updated. Synced latest settings.'
          : 'Settings updated. Synced latest settings.';

      if (payload?.profile) {
        setProfile((current) => ({
          ...current,
          firstName: payload.profile?.firstName ?? current.firstName,
          lastName: payload.profile?.lastName ?? current.lastName,
          displayName: payload.profile?.displayName ?? current.displayName,
          timezone: payload.profile?.timezone ?? current.timezone,
          glucoseUnit:
            payload.profile?.glucoseUnit === 'mg/dL' || payload.profile?.glucoseUnit === 'mmol/L'
              ? payload.profile.glucoseUnit
              : current.glucoseUnit,
          profileImageUrl: payload.profile?.profileImageUrl ?? current.profileImageUrl,
          defaultAlarmSoundId: payload.profile?.defaultAlarmSoundId ?? current.defaultAlarmSoundId
        }));
      }

      try {
        await reloadLatestSettings(message);
      } catch {
        setMessage('Settings changed, but reload failed');
        setMessageTone('error');
      }
    };

    window.addEventListener('pulse-settings-updated', handleSettingsUpdated);

    return () => {
      window.removeEventListener('pulse-settings-updated', handleSettingsUpdated);
    };
  }, [browserTimeZone]);

  async function save() {
    const timezone = profile.timezone.trim();
    if (!timezone || !isValidTimeZone(timezone)) {
      setMessage('Timezone must be a valid IANA timezone');
      setMessageTone('error');
      return;
    }

    const cleanedSounds = profile.alarmSounds.map((sound) => ({
      id: sound.id.trim(),
      name: sound.name.trim(),
      url: sound.url.trim()
    }));

    if (cleanedSounds.some((sound) => !sound.id || !sound.name || !sound.url)) {
      setMessage('Every alarm sound needs id, name, and URL');
      setMessageTone('error');
      return;
    }

    setSaving(true);
    setMessage('Saving settings...');
    setMessageTone('neutral');

    try {
      const response = await fetch('/api/dashboard/settings/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-timezone': browserTimeZone
        },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          timezone,
          glucoseUnit: profile.glucoseUnit,
          profileImageUrl: profile.profileImageUrl,
          profileImageDataUrl: profile.profileImageDataUrl,
          alarmSounds: cleanedSounds,
          defaultAlarmSoundId: profile.defaultAlarmSoundId
        })
      });

      const data = (await response.json()) as ConsumerProfileResponse & { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to save settings');
      }

      setProfile(data.profile);
      setSelectedImageName('');
      setMessage('Settings saved');
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
      setMessageTone('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel dashboard-section">
      <div className="dashboard-section__header">
        <div>
          <p className="kicker">Shared consumer settings</p>
          <h1 className="dashboard-section__title">Settings</h1>
          <p className="dashboard-section__meta">Manage the shared profile content used by connected apps.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void reload()} className="button-secondary" disabled={saving}>
            Reload
          </button>
          <button type="button" onClick={save} className="button-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">First name</span>
          <input
            value={profile.firstName}
            onChange={(event) => setField('firstName', event.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Last name</span>
          <input
            value={profile.lastName}
            onChange={(event) => setField('lastName', event.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Timezone</span>
          <div className="flex gap-3">
            <input
              value={profile.timezone}
              onChange={(event) => setField('timezone', event.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
            />
            <button
              type="button"
              onClick={() => setField('timezone', browserTimeZone)}
              className="button-secondary whitespace-nowrap"
            >
              Use current
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Glucose unit</span>
          <select
            value={profile.glucoseUnit}
            onChange={(event) => setField('glucoseUnit', event.target.value as ConsumerProfile['glucoseUnit'])}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
          >
            <option value="mmol/L">mmol/L</option>
            <option value="mg/dL">mg/dL</option>
          </select>
        </label>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="dashboard-subpanel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Alarm sounds</p>
              <p className="mt-2 text-sm text-[var(--text-dim)]">Add or remove shared alarm sound presets.</p>
            </div>
            <button type="button" onClick={addSound} className="button-secondary">
              Add sound
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {profile.alarmSounds.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">No alarm sounds configured.</p>
            ) : null}

            {profile.alarmSounds.map((sound, index) => (
              <div key={`${index}-${sound.id || 'new'}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    value={sound.id}
                    onChange={(event) => setSound(index, 'id', event.target.value)}
                    placeholder="sound-id"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
                  />
                  <input
                    value={sound.name}
                    onChange={(event) => setSound(index, 'name', event.target.value)}
                    placeholder="Display name"
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
                  />
                  <div className="flex gap-3">
                    <input
                      value={sound.url}
                      onChange={(event) => setSound(index, 'url', event.target.value)}
                      placeholder="https://example.com/sound.mp3"
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
                    />
                    <button type="button" onClick={() => removeSound(index)} className="button-secondary">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Default alarm sound</span>
            <select
              value={profile.defaultAlarmSoundId || ''}
              onChange={(event) => setField('defaultAlarmSoundId', event.target.value || null)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none"
            >
              <option value="">No default</option>
              {profile.alarmSounds
                .filter((sound) => sound.id.trim())
                .map((sound) => (
                  <option key={sound.id || sound.name} value={sound.id}>
                    {sound.name || sound.id}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="dashboard-subpanel">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Profile image</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]">
              {previewSrc ? (
                <img src={previewSrc} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-[var(--text-dim)]">No image</span>
              )}
            </div>
            <div className="space-y-3">
              <button type="button" onClick={openImagePicker} className="button-secondary">
                Upload image
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={onImageSelected}
                className="hidden"
                aria-label="Upload profile image"
              />
              <p className="text-xs text-[var(--text-dim)]">
                {selectedImageName || 'No file selected'}
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Updated</p>
          <p className="mt-2 text-sm text-[var(--text)]">{new Date(profile.updatedAt).toLocaleString()}</p>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Last updated by {profile.updatedBy.apiKeyName || 'admin dashboard'}
          </p>
        </div>
      </div>

      <p
        className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
          messageTone === 'error'
            ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
            : messageTone === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-dim)]'
        }`}
      >
        {message}
      </p>
    </div>
  );
}
