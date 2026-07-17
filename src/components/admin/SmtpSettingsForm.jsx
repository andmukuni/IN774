import { useEffect, useState } from 'react';
import { LoadingButton } from '../ui';

const inputClass =
  'w-full min-h-[44px] rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20';

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
    </label>
  );
}

export default function SmtpSettingsForm({
  settings,
  onSave,
  saving = false,
  canSave = true,
}) {
  const [form, setForm] = useState({
    smtpEnabled: false,
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: '',
  });
  const [passwordConfigured, setPasswordConfigured] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      smtpEnabled: settings.smtpEnabled === true,
      smtpHost: settings.smtpHost || '',
      smtpPort: String(settings.smtpPort || '587'),
      smtpSecure: settings.smtpSecure === true,
      smtpUser: settings.smtpUser || '',
      smtpPassword: '',
      smtpFromEmail: settings.smtpFromEmail || '',
      smtpFromName: settings.smtpFromName || '',
    });
    setPasswordConfigured(Boolean(settings.smtpPasswordConfigured));
  }, [settings]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      smtpEnabled: form.smtpEnabled,
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpSecure: form.smtpSecure,
      smtpUser: form.smtpUser,
      smtpFromEmail: form.smtpFromEmail,
      smtpFromName: form.smtpFromName,
    };
    if (form.smtpPassword.trim()) {
      payload.smtpPassword = form.smtpPassword;
    }
    onSave?.(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <label className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-navy-300 text-cyan-600 focus:ring-cyan-500"
          checked={form.smtpEnabled}
          onChange={(e) => update('smtpEnabled', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-navy-900">Enable outbound email</span>
          <span className="mt-0.5 block text-xs text-navy-500">
            Use these settings when the application sends email notifications.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SMTP host" hint="Example: smtp.gmail.com">
          <input
            className={inputClass}
            value={form.smtpHost}
            onChange={(e) => update('smtpHost', e.target.value)}
            placeholder="smtp.example.com"
            autoComplete="off"
          />
        </Field>
        <Field label="SMTP port" hint="587 for STARTTLS, 465 for SSL">
          <input
            type="number"
            min="1"
            max="65535"
            className={inputClass}
            value={form.smtpPort}
            onChange={(e) => update('smtpPort', e.target.value)}
            placeholder="587"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Username">
          <input
            className={inputClass}
            value={form.smtpUser}
            onChange={(e) => update('smtpUser', e.target.value)}
            placeholder="notifications@goodfellow.co.zm"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Password"
          hint={passwordConfigured ? 'Leave blank to keep the current password.' : 'Required for authenticated SMTP.'}
        >
          <input
            type="password"
            className={inputClass}
            value={form.smtpPassword}
            onChange={(e) => update('smtpPassword', e.target.value)}
            placeholder={passwordConfigured ? '••••••••' : 'Enter SMTP password'}
            autoComplete="new-password"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-navy-100 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-navy-300 text-cyan-600 focus:ring-cyan-500"
          checked={form.smtpSecure}
          onChange={(e) => update('smtpSecure', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-navy-900">Use SSL/TLS</span>
          <span className="mt-0.5 block text-xs text-navy-500">
            Enable for port 465. Leave off for STARTTLS on port 587.
          </span>
        </span>
      </label>

      <div className="space-y-4 border-t border-navy-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Sender identity</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From email">
            <input
              type="email"
              className={inputClass}
              value={form.smtpFromEmail}
              onChange={(e) => update('smtpFromEmail', e.target.value)}
              placeholder="noreply@goodfellow.co.zm"
            />
          </Field>
          <Field label="From name">
            <input
              className={inputClass}
              value={form.smtpFromName}
              onChange={(e) => update('smtpFromName', e.target.value)}
              placeholder="Goodfellow Inventory"
            />
          </Field>
        </div>
      </div>

      {canSave && (
        <div className="flex justify-end border-t border-navy-100 pt-4">
          <LoadingButton type="submit" loading={saving}>
            Save SMTP settings
          </LoadingButton>
        </div>
      )}
    </form>
  );
}
