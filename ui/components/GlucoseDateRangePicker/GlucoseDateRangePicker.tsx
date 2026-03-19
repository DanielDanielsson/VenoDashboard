'use client';

import { useEffect, useRef, useState } from 'react';

interface DateRangeValue {
  from: string;
  to: string;
}

interface GlucoseDateRangePickerProps {
  value: DateRangeValue | null;
  onApply: (value: DateRangeValue) => void;
}

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatTriggerLabel(value: DateRangeValue | null): string {
  if (!value) {
    return 'Custom';
  }

  const from = new Date(value.from);
  const to = new Date(value.to);
  const formatter = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });
  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function formatFullDate(date: Date | null): string {
  if (!date) {
    return 'Select date';
  }

  return new Intl.DateTimeFormat([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) {
    return false;
  }

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function compareDay(a: Date, b: Date): number {
  return startOfDay(a).getTime() - startOfDay(b).getTime();
}

function createMonthDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstWeekday;
    const date = new Date(year, monthIndex, 1 + dayOffset);
    days.push({
      date,
      inCurrentMonth: date.getMonth() === monthIndex
    });
  }

  return days;
}

export function GlucoseDateRangePicker({ value, onApply }: GlucoseDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => startOfDay(new Date()));
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function initializeDraft() {
    const initialFrom = value ? startOfDay(new Date(value.from)) : startOfDay(new Date());
    const initialTo = value ? startOfDay(new Date(value.to)) : startOfDay(new Date());
    setDraftStart(initialFrom);
    setDraftEnd(initialTo);
    setHoveredDate(null);
    setLeftMonth(new Date(initialFrom.getFullYear(), initialFrom.getMonth(), 1));
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const rightMonth = addMonths(leftMonth, 1);

  function handleDayClick(day: Date) {
    const normalizedDay = startOfDay(day);

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(normalizedDay);
      setDraftEnd(null);
      setHoveredDate(null);
      return;
    }

    if (compareDay(normalizedDay, draftStart) < 0) {
      setDraftStart(normalizedDay);
      setDraftEnd(draftStart);
      setHoveredDate(null);
      return;
    }

    setDraftEnd(normalizedDay);
    setHoveredDate(null);
  }

  function handleApply() {
    if (!draftStart || !draftEnd) {
      return;
    }

    onApply({
      from: startOfDay(draftStart).toISOString(),
      to: endOfDay(draftEnd).toISOString()
    });
    setIsOpen(false);
  }

  function renderMonth(month: Date) {
    const days = createMonthDays(month);
    const monthLabel = new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' }).format(month);
    const previewEnd =
      draftStart && !draftEnd && hoveredDate && compareDay(hoveredDate, draftStart) >= 0
        ? hoveredDate
        : draftEnd;

    return (
      <div style={{ minWidth: 248 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          <div style={{
            gridColumn: '1 / -1',
            marginBottom: 4,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            {monthLabel}
          </div>
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                fontSize: 11,
                color: 'var(--text-soft)',
                textAlign: 'center',
                fontWeight: 600
              }}
            >
              {label}
            </div>
          ))}
          {days.map((day) => {
            const isStart = isSameDay(day.date, draftStart);
            const isEnd = isSameDay(day.date, previewEnd);
            const inRange =
              draftStart &&
              previewEnd &&
              compareDay(day.date, draftStart) >= 0 &&
              compareDay(day.date, previewEnd) <= 0;

            return (
              <button
                key={day.date.toISOString()}
                type="button"
                onClick={() => handleDayClick(day.date)}
                onMouseEnter={() => setHoveredDate(startOfDay(day.date))}
                style={{
                  minHeight: 34,
                  borderRadius: 10,
                  border: isStart || isEnd ? '1px solid color-mix(in srgb, var(--accent) 55%, white 12%)' : '1px solid transparent',
                  background:
                    isStart || isEnd
                      ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                      : inRange
                        ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                        : 'transparent',
                  color: day.inCurrentMonth ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: 13,
                  fontWeight: isStart || isEnd ? 700 : 500
                }}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            initializeDraft();
          }
          setIsOpen((open) => !open);
        }}
        className={isOpen || value ? 'button-primary' : 'button-ghost'}
        style={{ minHeight: '2rem', padding: '0 0.8rem', fontSize: '0.78rem' }}
      >
        {formatTriggerLabel(value)}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            zIndex: 20,
            width: 'min(100vw - 24px, 580px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface-strong)',
            padding: 16,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(18px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--text-soft)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700
              }}>
                Custom range
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
                Pick start and end dates to filter the timeline.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="button-ghost"
                style={{ minHeight: '2rem', minWidth: '2rem' }}
                onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="button-ghost"
                style={{ minHeight: '2rem', minWidth: '2rem' }}
                onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
              >
                ›
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {renderMonth(leftMonth)}
            {renderMonth(rightMonth)}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 16,
            marginBottom: 16
          }}>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              background: 'var(--surface)'
            }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                From
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text)' }}>
                {formatFullDate(draftStart)}
              </p>
            </div>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
              background: 'var(--surface)'
            }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                To
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text)' }}>
                {formatFullDate(draftEnd)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button-ghost"
              style={{ minHeight: '2.1rem', fontSize: '0.8rem' }}
              onClick={() => {
                setDraftStart(null);
                setDraftEnd(null);
                setHoveredDate(null);
              }}
            >
              Clear
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="button-ghost"
                style={{ minHeight: '2.1rem', fontSize: '0.8rem' }}
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-primary"
                style={{ minHeight: '2.1rem', fontSize: '0.8rem' }}
                disabled={!draftStart || !draftEnd}
                onClick={handleApply}
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
