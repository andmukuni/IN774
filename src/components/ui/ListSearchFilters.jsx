import { Search, X } from 'lucide-react';
import DatePicker from './DatePicker';

export const emptySearchFilters = () => ({
  search: '',
  date_from: '',
  date_to: '',
});

const inputClass = 'w-full px-3 py-2 border border-navy-200 rounded-lg text-xs bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500';
const selectClass = `${inputClass} shrink-0`;

function DateFilterInput({ value, onChange, title, className = 'lg:w-36' }) {
  return (
    <DatePicker
      name={title}
      value={value}
      onChange={onChange}
      placeholder={title}
      clearable
      size="sm"
      className={`bg-white ${className}`}
    />
  );
}

export default function ListSearchFilters({
  values,
  onChange,
  onApply,
  onClear,
  placeholder = 'Search...',
  showDates = false,
  children,
}) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  const setDate = (key, val) => {
    const next = { ...values, [key]: val };
    onChange(next);
    onApply?.(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply?.(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 bg-white rounded-xl border border-navy-100 p-3 shadow-sm"
    >
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2">
        <input
          type="text"
          value={values.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} lg:flex-1 lg:min-w-[180px]`}
        />

        {children}

        {showDates && (
          <>
            <DateFilterInput
              value={values.date_from}
              onChange={(e) => setDate('date_from', e.target.value)}
              title="From date"
              className="lg:w-40"
            />
            <DateFilterInput
              value={values.date_to}
              onChange={(e) => setDate('date_to', e.target.value)}
              title="To date"
              className="lg:w-40"
            />
          </>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-medium rounded-lg transition whitespace-nowrap"
          >
            <Search size={14} />
            Filter
          </button>
          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-lg bg-navy-50 hover:bg-navy-100 text-navy-500 transition"
            title="Clear filters"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}

export { inputClass, selectClass };
