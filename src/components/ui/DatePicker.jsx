import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  WEEKDAY_LABELS,
  formatDisplayDate,
  formatISODate,
  formatMonthYear,
  getCalendarWeeks,
  isDateWithinRange,
  isSameDay,
  parseISODate,
} from '../../utils/dateUtils';

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 360;

function emitChange(onChange, name, value) {
  onChange?.({
    target: { name, value },
    currentTarget: { name, value },
  });
}

function computePopoverStyle(triggerRect) {
  const viewportPadding = 12;
  let top = triggerRect.bottom + 8;
  let left = triggerRect.left;

  if (left + POPOVER_WIDTH > window.innerWidth - viewportPadding) {
    left = window.innerWidth - POPOVER_WIDTH - viewportPadding;
  }
  if (left < viewportPadding) left = viewportPadding;

  if (top + POPOVER_HEIGHT > window.innerHeight - viewportPadding) {
    const above = triggerRect.top - POPOVER_HEIGHT - 8;
    if (above >= viewportPadding) top = above;
  }

  return { top, left, minWidth: Math.max(triggerRect.width, 240) };
}

export default function DatePicker({
  id,
  name,
  value = '',
  onChange,
  required = false,
  disabled = false,
  readOnly = false,
  placeholder = 'Select date',
  error = '',
  min,
  max,
  clearable = false,
  size = 'md',
  className = '',
}) {
  const fallbackId = useId();
  const inputId = id || name || fallbackId;
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0, minWidth: 240 });
  const selectedDate = parseISODate(value);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
  }, [value]);

  const updatePopoverPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopoverStyle(computePopoverStyle(rect));
  };

  useEffect(() => {
    if (!open) return undefined;

    updatePopoverPosition();

    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const onReposition = () => updatePopoverPosition();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const openCalendar = () => {
    if (disabled || readOnly) return;
    setViewDate(selectedDate || new Date());
    setOpen(true);
  };

  const selectDate = (date) => {
    if (!isDateWithinRange(date, min, max)) return;
    emitChange(onChange, name, formatISODate(date));
    setOpen(false);
  };

  const goToMonth = (offset) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const weeks = getCalendarWeeks(viewDate);
  const today = new Date();

  const triggerClass = size === 'sm'
    ? 'px-3 py-2 text-xs rounded-lg'
    : 'px-4 py-2.5 text-sm rounded-xl';

  const fieldClass = `relative w-full flex items-center gap-2 border transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-transparent ${triggerClass} ${
    error
      ? 'border-red-300 bg-red-50 text-red-900'
      : readOnly
        ? 'border-navy-200 bg-navy-50 text-navy-700'
        : 'border-navy-200 bg-navy-50 text-navy-900'
  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-cyan-300'} ${className}`;

  const calendar = open ? createPortal(
    <div
      ref={popoverRef}
      id={`${inputId}-calendar`}
      role="dialog"
      aria-label="Choose date"
      style={{
        position: 'fixed',
        top: popoverStyle.top,
        left: popoverStyle.left,
        width: POPOVER_WIDTH,
        minWidth: popoverStyle.minWidth,
        zIndex: 9999,
      }}
      className="rounded-2xl border border-navy-100 bg-white p-4 shadow-xl shadow-navy-900/10"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-800"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-navy-900">{formatMonthYear(viewDate)}</p>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="rounded-lg p-2 text-navy-500 hover:bg-navy-50 hover:text-navy-800"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-navy-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => {
          const inMonth = date.getMonth() === viewDate.getMonth();
          const iso = formatISODate(date);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          const isDisabled = !isDateWithinRange(date, min, max);

          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              onClick={() => selectDate(date)}
              className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : isToday
                    ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200'
                    : inMonth
                      ? 'text-navy-800 hover:bg-cyan-50 hover:text-cyan-700'
                      : 'text-navy-300 hover:bg-navy-50'
              } ${isDisabled ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3">
        <button
          type="button"
          onClick={() => selectDate(today)}
          disabled={!isDateWithinRange(today, min, max)}
          className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Today
        </button>
        {clearable && (
          <button
            type="button"
            onClick={() => {
              emitChange(onChange, name, '');
              setOpen(false);
            }}
            className="text-xs font-medium text-navy-500 hover:text-navy-700"
          >
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled || readOnly ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${inputId}-calendar`}
        onClick={openCalendar}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openCalendar();
          }
        }}
        className={fieldClass}
      >
        <Calendar size={size === 'sm' ? 14 : 16} className="shrink-0 text-cyan-600" />
        <span className={`flex-1 text-left truncate ${value ? '' : 'text-navy-400'}`}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        {clearable && value && !disabled && !readOnly && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              emitChange(onChange, name, '');
            }}
            className="shrink-0 rounded-md p-0.5 text-navy-400 hover:bg-navy-100 hover:text-navy-600"
            aria-label="Clear date"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <input
        type="hidden"
        id={inputId}
        name={name}
        value={value}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />

      {calendar}
    </div>
  );
}
