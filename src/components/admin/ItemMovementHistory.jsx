import {
  ArrowRightLeft,
  Building2,
  ClipboardList,
  History,
  User,
} from 'lucide-react';

const EVENT_STYLES = {
  registered: 'bg-emerald-100 text-emerald-700',
  intake: 'bg-cyan-100 text-cyan-700',
  assigned: 'bg-blue-100 text-blue-700',
  unassigned: 'bg-amber-100 text-amber-700',
  branch_linked: 'bg-indigo-100 text-indigo-700',
  transferred: 'bg-violet-100 text-violet-700',
  updated: 'bg-navy-100 text-navy-700',
};

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function EventIcon({ eventType }) {
  if (eventType === 'transferred') return <ArrowRightLeft size={14} />;
  if (eventType === 'assigned' || eventType === 'unassigned') return <User size={14} />;
  if (eventType === 'branch_linked' || eventType === 'intake') return <Building2 size={14} />;
  if (eventType === 'registered') return <ClipboardList size={14} />;
  return <History size={14} />;
}

export default function ItemMovementHistory({ history = [] }) {
  if (!history.length) {
    return (
      <p className="text-sm text-navy-500">
        No movement history recorded yet. Changes to assignment or branch will appear here.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-navy-100" />
      <ul className="space-y-4">
        {history.map((event, index) => (
          <li key={event.id} className="relative pl-10">
            <span
              className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                EVENT_STYLES[event.eventType] || EVENT_STYLES.updated
              }`}
            >
              <EventIcon eventType={event.eventType} />
            </span>

            <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{event.title}</p>
                  <p className="mt-1 text-sm text-navy-600">{event.summary}</p>
                </div>
                <time className="shrink-0 text-xs text-navy-400">
                  {formatWhen(event.createdAt)}
                </time>
              </div>

              {(event.fromEmployee || event.toEmployee || event.fromBranch || event.toBranch) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {event.fromEmployee && (
                    <span className="rounded-lg bg-navy-50 px-2 py-1 text-navy-600">
                      From: {event.fromEmployee}
                    </span>
                  )}
                  {event.toEmployee && (
                    <span className="rounded-lg bg-navy-50 px-2 py-1 text-navy-600">
                      To: {event.toEmployee}
                    </span>
                  )}
                  {event.fromBranch && (
                    <span className="rounded-lg bg-navy-50 px-2 py-1 text-navy-600">
                      From branch: {event.fromBranch.name}
                    </span>
                  )}
                  {event.toBranch && (
                    <span className="rounded-lg bg-navy-50 px-2 py-1 text-navy-600">
                      To branch: {event.toBranch.name}
                    </span>
                  )}
                </div>
              )}

              <p className="mt-2 text-[11px] uppercase tracking-wide text-navy-400">
                Source: {event.actor || 'system'}
                {index === 0 ? ' · Latest' : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
