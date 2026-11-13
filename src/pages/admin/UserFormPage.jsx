import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, FormField, LoadingButton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'user',
};

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users/${id}`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load user');
        }
        if (!cancelled) {
          const user = json.data;
          setForm({
            name: user.name || '',
            email: user.email || '',
            password: '',
            role: user.role || 'user',
          });
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to load user.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, toast]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.password) {
      toast.error('Password is required for new users.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(`${API_BASE}/admin/users${isEdit ? `/${id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to save user');
      }
      toast.success(isEdit ? 'User updated.' : 'User created.');
      navigate(isEdit ? `/admin/users/${id}` : '/admin/users');
    } catch (err) {
      toast.error(err?.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit User' : 'Add User'}
        subtitle={isEdit ? 'Update account details' : 'Create a new admin user account'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Users', to: '/admin/users' },
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card title="User details" className="max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Name"
                name="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
              <FormField
                label="Role"
                name="role"
                type="select"
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                options={ROLE_OPTIONS}
              />
              <FormField
                label={isEdit ? 'New password' : 'Password'}
                name="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required={!isEdit}
                placeholder={isEdit ? 'Leave blank to keep current' : ''}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <LoadingButton
                type="submit"
                loading={saving}
                loadingLabel="Saving..."
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                {isEdit ? 'Update user' : 'Create user'}
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/admin/users/${id}` : '/admin/users')}
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
