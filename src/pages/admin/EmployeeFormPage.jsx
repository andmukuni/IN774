import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, FormField, LoadingButton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const EMPTY_FORM = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  branchId: '',
  status: 'active',
};

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/branches?limit=100`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.ok) {
          setBranches(json.data || []);
        }
      } catch {
        if (!cancelled) toast.error('Unable to load branches.');
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/employees/${id}`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load employee');
        }
        if (!cancelled) {
          const employee = json.data;
          setForm({
            employeeCode: employee.employeeCode || '',
            firstName: employee.firstName || '',
            lastName: employee.lastName || '',
            email: employee.email || '',
            phone: employee.phone || '',
            jobTitle: employee.jobTitle || '',
            branchId: employee.branchId || '',
            status: employee.status || 'active',
          });
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to load employee.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, toast]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const branchOptions = [
    { value: '', label: loadingBranches ? 'Loading branches...' : 'Select branch' },
    ...branches.map((b) => ({
      value: b.id,
      label: `${b.code} — ${b.name}`,
    })),
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees${isEdit ? `/${id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to save employee');
      }
      toast.success(isEdit ? 'Employee updated.' : 'Employee saved.');
      navigate(isEdit ? `/admin/employees/${id}` : '/admin/employees');
    } catch (err) {
      toast.error(err?.message || 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        subtitle={isEdit ? 'Update staff profile and branch assignment' : 'Assign staff to a branch — products can be linked to this employee'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Employees', to: '/admin/employees' },
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card title="Employee details" className="max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Employee code"
                name="employeeCode"
                value={form.employeeCode}
                onChange={(e) => update('employeeCode', e.target.value)}
                placeholder="Optional — auto-generated if blank"
              />
              <FormField
                label="Job title"
                name="jobTitle"
                value={form.jobTitle}
                onChange={(e) => update('jobTitle', e.target.value)}
                placeholder="Inventory Clerk"
              />
              <FormField
                label="First name"
                name="firstName"
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                required
              />
              <FormField
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                required
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
              <FormField
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+260 ..."
              />
              <FormField
                label="Branch"
                name="branchId"
                type="select"
                value={form.branchId}
                onChange={(e) => update('branchId', e.target.value)}
                options={branchOptions}
                required
                disabled={loadingBranches}
              />
              <FormField
                label="Status"
                name="status"
                type="select"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <LoadingButton
                type="submit"
                loading={saving}
                loadingLabel="Saving..."
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                {isEdit ? 'Update employee' : 'Save employee'}
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/admin/employees/${id}` : '/admin/employees')}
                className="px-5 py-2.5 rounded-xl border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                Cancel
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
