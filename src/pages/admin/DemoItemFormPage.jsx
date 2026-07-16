import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Card, FormField, LoadingButton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const EMPTY_FORM = {
  sku: '',
  name: '',
  category: '',
  brandId: '',
  quantity: '0',
  reorderLevel: '10',
  unitPrice: '',
  employeeId: '',
  status: '',
};

export default function DemoItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = getAdminAuthHeaders();
        const [empRes, brandRes, typeRes] = await Promise.all([
          fetch(`${API_BASE}/admin/employees?limit=100&status=active`, { headers }),
          fetch(`${API_BASE}/admin/brands?limit=100&status=active`, { headers }),
          fetch(`${API_BASE}/admin/product-types?limit=100&status=active`, { headers }),
        ]);
        const [empJson, brandJson, typeJson] = await Promise.all([
          empRes.json().catch(() => ({})),
          brandRes.json().catch(() => ({})),
          typeRes.json().catch(() => ({})),
        ]);
        if (!cancelled) {
          if (empRes.ok && empJson?.ok) setEmployees(empJson.data || []);
          if (brandRes.ok && brandJson?.ok) setBrands(brandJson.data || []);
          if (typeRes.ok && typeJson?.ok) setProductTypes(typeJson.data || []);
        }
      } catch {
        if (!cancelled) toast.error('Unable to load form options.');
      } finally {
        if (!cancelled) {
          setLoadingEmployees(false);
          setLoadingCatalog(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/items/${id}`, {
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'Failed to load product');
        }
        if (!cancelled) {
          const item = json.data;
          setForm({
            sku: item.sku || '',
            name: item.name || '',
            category: item.category || '',
            brandId: item.brandId || '',
            quantity: String(item.quantity ?? 0),
            reorderLevel: String(item.reorderLevel ?? 0),
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
            employeeId: item.employeeId || '',
            status: item.status === 'discontinued' ? 'discontinued' : '',
          });
        }
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Unable to load product.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, toast]);

  const selectedEmployee = employees.find((e) => e.id === form.employeeId);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sku.trim()) {
      toast.error('S/N is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        category: form.category,
        brandId: form.brandId || null,
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        employeeId: form.employeeId || null,
        status: form.status === 'discontinued' ? 'discontinued' : undefined,
      };

      const res = await fetch(`${API_BASE}/admin/items${isEdit ? `/${id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Failed to save product');
      }
      toast.success(isEdit ? 'Product updated.' : 'Product saved.');
      navigate(isEdit ? `/admin/items/${id}` : '/admin/items');
    } catch (err) {
      toast.error(err?.message || 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Product' : 'Add Product'}
        subtitle={isEdit ? 'Update inventory item details' : 'Create a new inventory item'}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Products', to: '/admin/items' },
          { label: isEdit ? 'Edit' : 'Add' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card title="Product details" className="max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="S/N"
                name="sku"
                value={form.sku}
                onChange={(e) => update('sku', e.target.value)}
                placeholder="Enter serial number"
                required
              />
              <FormField
                label="Name"
                name="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
              <FormField
                label="Product type"
                name="category"
                type="select"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                options={[
                  { value: '', label: loadingCatalog ? 'Loading types...' : 'Select type' },
                  ...productTypes.map((t) => ({ value: t.name, label: t.name })),
                ]}
                disabled={loadingCatalog}
              />
              <FormField
                label="Brand"
                name="brandId"
                type="select"
                value={form.brandId}
                onChange={(e) => update('brandId', e.target.value)}
                options={[
                  { value: '', label: loadingCatalog ? 'Loading brands...' : 'Unbranded' },
                  ...brands.map((b) => ({ value: b.id, label: b.name })),
                ]}
                disabled={loadingCatalog}
              />
              <FormField
                label="Quantity"
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                min={0}
              />
              <FormField
                label="Reorder level"
                name="reorderLevel"
                type="number"
                value={form.reorderLevel}
                onChange={(e) => update('reorderLevel', e.target.value)}
                min={0}
              />
              <FormField
                label="Unit price (K)"
                name="unitPrice"
                type="number"
                value={form.unitPrice}
                onChange={(e) => update('unitPrice', e.target.value)}
                min={0}
                step="0.01"
                placeholder="Optional — ZMW"
              />
              <FormField
                label="Assigned employee"
                name="employeeId"
                type="select"
                value={form.employeeId}
                onChange={(e) => update('employeeId', e.target.value)}
                options={[
                  { value: '', label: loadingEmployees ? 'Loading employees...' : 'Unassigned' },
                  ...employees.map((e) => ({
                    value: e.id,
                    label: `${e.employeeCode} — ${e.fullName} (${e.branchCode || 'no branch'})`,
                  })),
                ]}
                disabled={loadingEmployees}
              />
              {isEdit && (
                <FormField
                  label="Status"
                  name="status"
                  type="select"
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  options={[
                    { value: '', label: 'Auto (from stock levels)' },
                    { value: 'discontinued', label: 'Discontinued' },
                  ]}
                />
              )}
              {selectedEmployee && (
                <div className="sm:col-span-2 rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-sm text-navy-600">
                  Branch via employee:{' '}
                  <span className="font-medium text-navy-800">
                    {selectedEmployee.branchCode ? `${selectedEmployee.branchCode} — ${selectedEmployee.branchName}` : '—'}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <LoadingButton
                type="submit"
                loading={saving}
                loadingLabel="Saving..."
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
              >
                {isEdit ? 'Update product' : 'Save product'}
              </LoadingButton>
              <button
                type="button"
                onClick={() => navigate(isEdit ? `/admin/items/${id}` : '/admin/items')}
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
