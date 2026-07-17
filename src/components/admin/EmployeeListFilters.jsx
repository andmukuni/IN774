import { Search, X } from 'lucide-react';

export const emptyEmployeeFilters = () => ({
  code: '',
  name: '',
  role: '',
  branchId: '',
  status: '',
});

const fieldClass = 'w-full min-w-0 px-2.5 py-2 border border-navy-200 rounded-lg text-xs bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500';

export default function EmployeeListFilters({
  values,
  onChange,
  onApply,
  onClear,
  branches = [],
}) {
  const set = (key, val) => onChange({ ...values, [key]: val });

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply?.(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 bg-white rounded-xl border border-navy-100 p-3 shadow-sm"
    >
      <div className="grid w-full grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.85fr)_auto] items-center gap-2">
        <input
          type="text"
          value={values.code}
          onChange={(e) => set('code', e.target.value)}
          placeholder="Code"
          className={fieldClass}
        />
        <input
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Name"
          className={fieldClass}
        />
        <input
          type="text"
          value={values.role}
          onChange={(e) => set('role', e.target.value)}
          placeholder="Role"
          className={fieldClass}
        />
        <select
          value={values.branchId}
          onChange={(e) => set('branchId', e.target.value)}
          className={`${fieldClass} truncate`}
          title={values.branchId
            ? branches.find((branch) => branch.id === values.branchId)?.name
            : 'All branches'}
        >
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code ? `${branch.code} · ${branch.name}` : branch.name}
            </option>
          ))}
        </select>
        <select
          value={values.status}
          onChange={(e) => set('status', e.target.value)}
          className={fieldClass}
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

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
