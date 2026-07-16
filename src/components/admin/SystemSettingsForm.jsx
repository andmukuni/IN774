import { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
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

export default function SystemSettingsForm({
  settings,
  intakeUrl,
  onSave,
  saving = false,
  canSave = true,
}) {
  const [form, setForm] = useState({
    companyName: '',
    supportEmail: '',
    supportPhone: '',
    intakeEnabled: true,
    intakeIntroText: '',
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      companyName: settings.companyName || '',
      supportEmail: settings.supportEmail || '',
      supportPhone: settings.supportPhone || '',
      intakeEnabled: settings.intakeEnabled !== false,
      intakeIntroText: settings.intakeIntroText || '',
    });
  }, [settings]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const copyIntakeUrl = async () => {
    if (!intakeUrl) return;
    try {
      await navigator.clipboard.writeText(intakeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave?.(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Organization</p>
        <Field label="Company name">
          <input
            className={inputClass}
            value={form.companyName}
            onChange={(e) => update('companyName', e.target.value)}
            placeholder="Goodfellow Inventory"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email">
            <input
              type="email"
              className={inputClass}
              value={form.supportEmail}
              onChange={(e) => update('supportEmail', e.target.value)}
              placeholder="it@goodfellow.co.zm"
            />
          </Field>
          <Field label="Support phone">
            <input
              type="tel"
              className={inputClass}
              value={form.supportPhone}
              onChange={(e) => update('supportPhone', e.target.value)}
              placeholder="+260 ..."
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4 border-t border-navy-100 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Public intake</p>

        <Field
          label="Intake URL"
          hint="Share this link with branch staff to report equipment."
        >
          <div className="flex items-stretch gap-2">
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={intakeUrl || ''}
              readOnly
            />
            <button
              type="button"
              onClick={copyIntakeUrl}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-navy-200 px-3 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              <Copy size={15} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            {intakeUrl && (
              <a
                href={intakeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-navy-200 px-3 text-navy-700 hover:bg-navy-50"
                title="Open intake form"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </Field>

        <label className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-navy-300 text-cyan-600 focus:ring-cyan-500"
            checked={form.intakeEnabled}
            onChange={(e) => update('intakeEnabled', e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-navy-900">Enable branch intake form</span>
            <span className="mt-0.5 block text-xs text-navy-500">
              When disabled, staff cannot submit new equipment reports.
            </span>
          </span>
        </label>

        <Field
          label="Intake intro text"
          hint="Shown at the start of the public branch equipment form."
        >
          <textarea
            className={`${inputClass} min-h-[96px] resize-y py-3`}
            value={form.intakeIntroText}
            onChange={(e) => update('intakeIntroText', e.target.value)}
            placeholder="Select your branch to report computers and printers in use."
          />
        </Field>
      </div>

      {canSave && (
        <div className="flex justify-end border-t border-navy-100 pt-4">
          <LoadingButton type="submit" loading={saving}>
            Save settings
          </LoadingButton>
        </div>
      )}
    </form>
  );
}
