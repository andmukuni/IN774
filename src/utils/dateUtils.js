const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function parseISODate(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value) {
  const date = parseISODate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function isDateWithinRange(date, min, max) {
  const iso = formatISODate(date);
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

export function getCalendarWeeks(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  const weeks = [];
  let cursor = new Date(startDate);

  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

export { WEEKDAY_LABELS };
