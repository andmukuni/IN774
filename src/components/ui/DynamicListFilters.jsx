import { Search, X } from 'lucide-react';

const fieldClass = 'w-full min-w-0 px-2.5 py-2 border border-navy-200 rounded-lg text-xs bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500';

export function buildEmptyFilters(fields = []) {
  return fields.reduce((acc, field) => {
    acc[field.key] = field.defaultValue ?? '';
    return acc;
  }, {});
}

function FilterField({ field, value, onChange, optionsMap = {} }) {
  if (field.type === 'select') {
    const options = field.options || optionsMap[field.optionsKey] || [];
    const selectedOption = options.find((option) => String(option.value) === String(value));

    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} truncate`}
        title={selectedOption?.label || field.placeholder || field.label}
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || field.label}
      className={fieldClass}
    />
  );
}

export default function DynamicListFilters({
  fields,
  values,
  onChange,
  onApply,
  onClear,
  optionsMap = {},
}) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply?.(values);
  };

  const gridTemplateColumns = [
    ...fields.map((field) => `minmax(0, ${field.weight || 1}fr)`),
    'auto',
  ].join(' ');

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 bg-white rounded-xl border border-navy-100 p-3 shadow-sm"
    >
      <div
        className="grid w-full items-center gap-2"
        style={{ gridTemplateColumns }}
      >
        {fields.map((field) => (
          <FilterField
            key={field.key}
            field={field}
            value={values[field.key] ?? ''}
            onChange={(val) => set(field.key, val)}
            optionsMap={optionsMap}
          />
        ))}

        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            className="inline-flex items-center justify-center p-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition shrink-0"
            title="Apply filters"
            aria-label="Apply filters"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-lg bg-navy-50 hover:bg-navy-100 text-navy-500 transition shrink-0"
            title="Clear filters"
            aria-label="Clear filters"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
