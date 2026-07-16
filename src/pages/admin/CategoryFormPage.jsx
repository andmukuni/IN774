import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, FormField, LoadingButton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  status: 'active',
};

export default function CategoryFormPage() {
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
        const res = await fetch(`${API_BASE}/admin/product-types/${id}`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load product type');
        }
        if (!cancelled) {
          const type = json.data;
          setForm({
            code: type.code || '',
            name: type.name || '',
            description: type.description || '',
            status: type.status || 'active',
          });
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to load product type.');
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
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/product-types${isEdit ? `/${id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to save product type');
      }
      toast.success(isEdit ? 'Product type updated.' : 'Product type saved.');
      navigate(isEdit ? `/admin/categories/${id}` : '/admin/categories');
    } catch (err) {
      toast.error(err?.message || 'Unable to save product type.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Product Type' : 'Add Product Type'}
        subtitle={isEdit ? 'Update device category details' : 'Register a new device category such as Monitor, Laptop, or Printer'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Product Types', to: '/admin/categories' },
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card title="Product type details" className="max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Type code"
                name="code"
                value={form.code}
                onChange={(e) => update('code', e.target.value)}
                required
                placeholder="MONITOR"
              />
              <FormField
                label="Name"
                name="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                placeholder="Monitor"
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
              <div className="sm:col-span-2">
                <FormField
                  label="Description"
                  name="description"
                  textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Optional description for this device type"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <LoadingButton
                type="submit"
                loading={saving}
                loadingLabel="Saving..."
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                {isEdit ? 'Update product type' : 'Save product type'}
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/admin/categories/${id}` : '/admin/categories')}
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
