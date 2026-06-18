import type { SharedTimer } from '@/lib/veno-api/types';

export const formatDurationLabel = (totalSeconds: number): string => {
  const seconds = Math.max(1, Math.round(totalSeconds));
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
};

export const getServerOffsetMs = (serverNow: string): number => {
  return new Date(serverNow).getTime() - Date.now();
};

export const sortTimers = (items: SharedTimer[]): SharedTimer[] => {
  return [...items].sort((left, right) => {
    const fireDiff = new Date(left.fireAt).getTime() - new Date(right.fireAt).getTime();
    if (fireDiff !== 0) {
      return fireDiff;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
};

export const upsertTimer = (items: SharedTimer[], timer: SharedTimer): SharedTimer[] => {
  const nextItems = items.filter((item) => item.id !== timer.id);
  nextItems.push(timer);
  return sortTimers(nextItems);
};
