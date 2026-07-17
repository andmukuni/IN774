import { Search, X } from 'lucide-react';
import { inputClass, selectClass } from '../ui/ListSearchFilters';

export const emptyEmployeeFilters = () => ({
  code: '',
  name: '',
  role: '',
  branchId: '',
  status: '',
});

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
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
        <input
          type="text"
          value={values.code}
          onChange={(e) => set('code', e.target.value)}
          placeholder="Code"
          className={`${inputClass} min-w-[7rem] w-28 shrink-0`}
        />
        <input
          type="text"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Name"
          className={`${inputClass} min-w-[8rem] w-32 shrink-0`}
        />
        <input
          type="text"
          value={values.role}
          onChange={(e) => set('role', e.target.value)}
          placeholder="Role"
          className={`${inputClass} min-w-[7rem] w-28 shrink-0`}
        />
        <select
          value={values.branchId}
          onChange={(e) => set('branchId', e.target.value)}
          className={`${selectClass} min-w-[9rem] w-36 shrink-0`}
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
          className={`${selectClass} min-w-[7rem] w-28 shrink-0`}
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="submit"
            className="inline-flex items-center justify-center p-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg transition"
            title="Apply filters"
            aria-label="Apply filters"
          >
            <Search size={16} />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-lg bg-navy-50 hover:bg-navy-100 text-navy-500 transition"
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
