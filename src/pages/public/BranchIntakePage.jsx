import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HelpCircle,
  Info,
  Laptop,
  Monitor,
  Printer,
  Smartphone,
  Tablet,
  Tv,
  User,
} from 'lucide-react';
import { Modal } from '../../components/ui';
import { getApiBase } from '../../utils/apiBase';

const API_BASE = getApiBase();

const STEPS = [
  { key: 'branch', label: 'Branch' },
  { key: 'employee', label: 'You' },
  { key: 'devices', label: 'Devices' },
  { key: 'printers', label: 'Printers' },
  { key: 'review', label: 'Submit' },
];

const TYPE_ICON_MAP = {
  Monitor,
  Desktop: Cpu,
  Laptop,
  'All-in-One': Monitor,
  Tablet,
  Phone: Smartphone,
  TV: Tv,
};

const TYPE_LABEL_OVERRIDES = {
  Desktop: 'Desktop / CPU',
  Phone: 'Mobile phone',
};

const FALLBACK_DEVICE_TYPES = [
  { value: 'Monitor', label: 'Monitor' },
  { value: 'Desktop', label: 'Desktop / CPU' },
  { value: 'Laptop', label: 'Laptop' },
  { value: 'All-in-One', label: 'All-in-One' },
  { value: 'Tablet', label: 'Tablet' },
  { value: 'Phone', label: 'Mobile phone' },
  { value: 'TV', label: 'TV' },
];

const emptyPrinter = () => ({
  brandId: '',
  model: '',
  serialNumber: '',
});

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div
          key={s.key}
          className={`h-2 rounded-full transition-all ${
            i === step ? 'w-8 bg-cyan-600' : i < step ? 'w-2 bg-cyan-400' : 'w-2 bg-navy-200'
          }`}
          title={s.label}
        />
      ))}
    </div>
  );
}

function Field({ label, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full min-h-[48px] rounded-xl border border-navy-200 bg-white px-4 py-3 text-base text-navy-900 placeholder:text-navy-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20';

function typeLabel(name) {
  return TYPE_LABEL_OVERRIDES[name] || name;
}

function typeIcon(name) {
  return TYPE_ICON_MAP[name] || Monitor;
}

const emptyDraftDevice = () => ({
  type: '',
  brandId: '',
  model: '',
  serialNumber: '',
});

function SerialNumberHelpModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How to find your PC serial number"
      subtitle="When the sticker has faded — check inside Windows while the computer is on"
      size="md"
      footer={(
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-xl bg-cyan-600 px-5 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Got it
        </button>
      )}
    >
      <div className="space-y-5 text-sm text-navy-700">
        <p>
          The serial number (S/N) is usually on a sticker on the device. If you cannot read it,
          try these steps on a <span className="font-medium text-navy-900">Windows PC that is switched on</span>.
        </p>

        <section className="space-y-2">
          <h3 className="font-semibold text-navy-900">Option 1 — Settings (easiest)</h3>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Press the <span className="font-medium">Windows</span> key and open <span className="font-medium">Settings</span>.</li>
            <li>Go to <span className="font-medium">System</span> → <span className="font-medium">About</span>.</li>
            <li>Under <span className="font-medium">Device specifications</span>, look for <span className="font-medium">Serial number</span>.</li>
            <li>Copy that value into the form. (Some PCs may not show it here — try Option 2.)</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold text-navy-900">Option 2 — Command Prompt</h3>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Press the <span className="font-medium">Windows</span> key, type <span className="font-medium">cmd</span>, and open <span className="font-medium">Command Prompt</span>.</li>
            <li>Type this command exactly and press <span className="font-medium">Enter</span>:</li>
          </ol>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-navy-900 px-4 py-3 text-xs text-cyan-100">
            wmic bios get serialnumber
          </pre>
          <p className="text-navy-600">The line under <span className="font-medium">SerialNumber</span> is your S/N.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold text-navy-900">Option 3 — PowerShell (if Option 2 fails)</h3>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Press the <span className="font-medium">Windows</span> key, type <span className="font-medium">PowerShell</span>, and open it.</li>
            <li>Paste this command and press <span className="font-medium">Enter</span>:</li>
          </ol>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-navy-900 px-4 py-3 text-xs text-cyan-100">
            Get-CimInstance -ClassName Win32_BIOS | Select-Object SerialNumber
          </pre>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-medium">If the result is blank or says &quot;To be filled by O.E.M&quot;</p>
          <p className="mt-1 text-amber-800">
            The manufacturer may not have stored the S/N in firmware. Check the bottom of a laptop,
            the back of a monitor, or the side/rear of a desktop tower. You can leave the field blank —
            we will auto-generate a reference number.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold text-navy-900">Apple Mac (if applicable)</h3>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Click the <span className="font-medium">Apple menu</span> → <span className="font-medium">About This Mac</span>.</li>
            <li>Click <span className="font-medium">More Info…</span> (or <span className="font-medium">System Report</span> on older macOS).</li>
            <li>Find <span className="font-medium">Serial Number</span> under Hardware Overview.</li>
          </ol>
        </section>
      </div>
    </Modal>
  );
}

const INTAKE_SUBMISSION_KEY = (branchCode) => `gfl-intake-submitted:${branchCode}`;

function readStoredSubmission(branchCode) {
  if (!branchCode) return null;
  try {
    const raw = sessionStorage.getItem(INTAKE_SUBMISSION_KEY(branchCode));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSubmission(branchCode, summary) {
  if (!branchCode) return;
  sessionStorage.setItem(
    INTAKE_SUBMISSION_KEY(branchCode),
    JSON.stringify({ ...summary, submittedAt: new Date().toISOString() }),
  );
}

function formatSubmittedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return null;
  }
}

function IntakeSuccessScreen({ summary }) {
  const submittedLabel = formatSubmittedAt(summary.submittedAt);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check size={28} />
        </div>
        <h2 className="text-xl font-bold text-navy-900">Thank you!</h2>
        <p className="mt-2 text-sm text-navy-600">
          Equipment for <span className="font-medium">{summary.branch?.name}</span> has been recorded.
        </p>
        {submittedLabel && (
          <p className="mt-1 text-xs text-navy-500">Submitted {submittedLabel}</p>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">One submission per person</p>
          <p className="mt-1 text-amber-800">
            Your report has been saved. Please do not submit again — duplicate entries make
            inventory harder to manage. Contact your branch manager or IT if something needs to change.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm space-y-4 text-sm">
        <p className="font-semibold text-navy-900">Your submission summary</p>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">Branch</p>
          <p className="font-medium text-navy-900 flex items-center gap-2">
            <Building2 size={15} className="text-cyan-600" />
            {summary.branch?.name}
          </p>
          <p className="text-navy-600">{summary.branch?.code}{summary.branch?.city ? ` · ${summary.branch.city}` : ''}</p>
        </div>

        <div className="space-y-1 border-t border-navy-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">You</p>
          <p className="font-medium text-navy-900 flex items-center gap-2">
            <User size={15} className="text-cyan-600" />
            {summary.employee?.fullName || '—'}
            {summary.employee?.jobTitle ? ` · ${summary.employee.jobTitle}` : ''}
          </p>
          {summary.employee?.email && (
            <p className="text-navy-600">{summary.employee.email}</p>
          )}
          {summary.employee?.phone && (
            <p className="text-navy-600">{summary.employee.phone}</p>
          )}
        </div>

        {summary.devices?.length > 0 && (
          <div className="space-y-2 border-t border-navy-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-400">
              Your devices ({summary.devices.length})
            </p>
            <ul className="space-y-2">
              {summary.devices.map((device, index) => (
                <li
                  key={`device-${index}`}
                  className="rounded-xl bg-navy-50/60 px-3 py-2 text-navy-700"
                >
                  <p className="font-medium text-navy-900">
                    {device.type}
                    {device.brand ? ` · ${device.brand}` : ''}
                  </p>
                  <p className="text-xs text-navy-500">
                    {[
                      device.model && `Model: ${device.model}`,
                      device.serialNumber ? `S/N: ${device.serialNumber}` : 'S/N: auto-generated',
                    ].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.printers?.length > 0 && (
          <div className="space-y-2 border-t border-navy-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-400">
              Branch printers ({summary.printers.length})
            </p>
            <ul className="space-y-2">
              {summary.printers.map((printer, index) => (
                <li
                  key={`printer-${index}`}
                  className="rounded-xl bg-navy-50/60 px-3 py-2 text-navy-700"
                >
                  <p className="font-medium text-navy-900">
                    Printer{printer.brand ? ` · ${printer.brand}` : ''}
                  </p>
                  <p className="text-xs text-navy-500">
                    {[
                      printer.model && `Model: ${printer.model}`,
                      printer.serialNumber ? `S/N: ${printer.serialNumber}` : 'S/N: auto-generated',
                    ].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  required = false,
  placeholder = 'Search...',
  value,
  onChange,
  options = [],
  getValue = (o) => o.value,
  getLabel = (o) => o.label,
  getHint = (o) => o.hint ?? '',
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isTypingRef = useRef(false);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const match = options.find((o) => getValue(o) === value);
    return match ? getLabel(match) : '';
  }, [value, options, getValue, getLabel]);

  // Sync display when value changes externally (pick, form reset) — not while typing
  useEffect(() => {
    if (isTypingRef.current) return;
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const haystack = `${getLabel(o)} ${getHint(o)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query, getLabel, getHint]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    isTypingRef.current = false;
    if (value) {
      setQuery(selectedLabel);
    } else {
      setQuery('');
    }
  }, [value, selectedLabel]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [closeDropdown]);

  const pick = (option) => {
    isTypingRef.current = false;
    onChange(getValue(option));
    setQuery(getLabel(option));
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    isTypingRef.current = true;
    setQuery(next);
    setOpen(true);
    if (value) {
      const match = options.find((o) => getValue(o) === value);
      if (!match || next !== getLabel(match)) {
        onChange('');
      }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Field label={label} required={required}>
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`${inputClass} pr-11 ${disabled ? 'opacity-50' : ''}`}
            value={query}
            placeholder={placeholder}
            onChange={handleInputChange}
            onFocus={() => !disabled && setOpen(true)}
          />
          <ChevronDown
            size={18}
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </Field>
      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-navy-500">No matches found</li>
          ) : (
            filtered.map((option) => (
              <li key={String(getValue(option))} role="option">
                <button
                  type="button"
                  onClick={() => pick(option)}
                  className="w-full px-4 py-3 text-left hover:bg-cyan-50 active:bg-cyan-100"
                >
                  <p className="font-medium text-navy-900">{getLabel(option)}</p>
                  {getHint(option) ? (
                    <p className="text-xs text-navy-500">{getHint(option)}</p>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SearchableBranchField({ branches, branch, onBranchChange, placeholder = 'Branch name' }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(branch?.name || '');

  useEffect(() => {
    setQuery(branch?.name || '');
  }, [branch?.id, branch?.name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => {
      const haystack = `${b.name} ${b.code} ${b.city}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [branches, query]);

  const trimmedQuery = query.trim();
  const exactMatch = useMemo(() => {
    if (!trimmedQuery) return null;
    return branches.find((b) => b.name.toLowerCase() === trimmedQuery.toLowerCase()) || null;
  }, [branches, trimmedQuery]);

  const showCustomOption = Boolean(
    trimmedQuery.length >= 2
    && !exactMatch
    && !filtered.some((b) => b.name.toLowerCase() === trimmedQuery.toLowerCase()),
  );

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const pickBranch = (item) => {
    onBranchChange(item);
    setQuery(item.name);
    setOpen(false);
  };

  const pickCustomBranch = () => {
    onBranchChange({ name: trimmedQuery, isCustom: true });
    setQuery(trimmedQuery);
    setOpen(false);
  };

  const handleQueryChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);

    const nextTrimmed = next.trim();
    const match = nextTrimmed
      ? branches.find((b) => b.name.toLowerCase() === nextTrimmed.toLowerCase())
      : null;

    if (match) {
      onBranchChange(match);
    } else if (nextTrimmed.length >= 2) {
      onBranchChange({ name: nextTrimmed, isCustom: true });
    } else {
      onBranchChange(null);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Field label="Branch" required>
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            className={`${inputClass} pr-11`}
            value={query}
            placeholder={placeholder}
            onChange={handleQueryChange}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown
            size={18}
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </Field>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-navy-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 && !showCustomOption ? (
            <li className="px-4 py-3 text-sm text-navy-500">Type a branch name to continue</li>
          ) : (
            <>
              {filtered.map((b) => (
                <li key={b.id} role="option">
                  <button
                    type="button"
                    onClick={() => pickBranch(b)}
                    className="w-full px-4 py-3 text-left hover:bg-cyan-50 active:bg-cyan-100"
                  >
                    <p className="font-medium text-navy-900">{b.name}</p>
                    <p className="text-xs text-navy-500">{b.code}{b.city ? ` · ${b.city}` : ''}</p>
                  </button>
                </li>
              ))}
              {showCustomOption && (
                <li role="option">
                  <button
                    type="button"
                    onClick={pickCustomBranch}
                    className="w-full border-t border-navy-100 px-4 py-3 text-left hover:bg-cyan-50 active:bg-cyan-100"
                  >
                    <p className="font-medium text-cyan-800">Use &ldquo;{trimmedQuery}&rdquo;</p>
                    <p className="text-xs text-navy-500">Add this branch if it is missing from the list</p>
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function DeviceCard({ title, icon: Icon, device, brands, onChange, onRemove, canRemove }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-navy-900 font-semibold">
          {Icon && <Icon size={18} className="text-cyan-600" />}
          {title}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Remove
          </button>
        )}
      </div>
      <SearchableSelect
        label="Brand"
        placeholder="Search brand"
        value={device.brandId}
        onChange={(brandId) => onChange({ ...device, brandId })}
        options={brands.map((b) => ({ value: b.id, label: b.name }))}
      />
      <Field label="Model (optional)">
        <input
          className={inputClass}
          value={device.model}
          onChange={(e) => onChange({ ...device, model: e.target.value })}
          placeholder="e.g. EliteBook 840"
        />
      </Field>
      <Field label="Serial / S/N (optional)">
        <input
          className={inputClass}
          value={device.serialNumber}
          onChange={(e) => onChange({ ...device, serialNumber: e.target.value })}
          placeholder="Auto-generated if blank"
        />
      </Field>
    </div>
  );
}

export default function BranchIntakePage() {
  const { branchCode } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingBranch, setResolvingBranch] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submissionSummary, setSubmissionSummary] = useState(null);
  const [branches, setBranches] = useState([]);
  const [existingEquipment, setExistingEquipment] = useState({ employeeDevices: [], branchPrinters: [] });
  const [brands, setBrands] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [branch, setBranch] = useState(null);
  const [employee, setEmployee] = useState({
    firstName: '',
    lastName: '',
    emailLocal: '',
    phoneLocal: '',
    jobTitle: '',
  });
  const [devices, setDevices] = useState([]);
  const [draftDevice, setDraftDevice] = useState(emptyDraftDevice);
  const [printers, setPrinters] = useState([]);
  const [snHelpOpen, setSnHelpOpen] = useState(false);
  const [publicSettings, setPublicSettings] = useState({
    intakeEnabled: true,
    intakeIntroText: 'Select your branch to report computers and printers in use.',
    supportEmail: '',
    supportPhone: '',
  });

  const brandName = (id) => brands.find((b) => b.id === id)?.name || '';

  const buildSubmissionSummary = useCallback(() => ({
    branch: {
      name: branch?.name,
      code: branch?.code,
      city: branch?.city,
    },
    employee: {
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      jobTitle: employee.jobTitle?.trim() || '',
      email: employee.emailLocal.trim()
        ? `${employee.emailLocal.trim()}@goodfellow.co.zm`
        : '',
      phone: employee.phoneLocal.trim()
        ? `+260${employee.phoneLocal.trim().replace(/^0+/, '')}`
        : '',
    },
    devices: devices.map((d) => ({
      type: typeLabel(d.type),
      brand: brandName(d.brandId),
      model: d.model?.trim() || '',
      serialNumber: d.serialNumber?.trim() || '',
    })),
    printers: printers.map((p) => ({
      brand: brandName(p.brandId),
      model: p.model?.trim() || '',
      serialNumber: p.serialNumber?.trim() || '',
    })),
  }), [branch, employee, devices, printers, brands]);

  const loadPublicSettings = useCallback(async () => {
    const res = await fetch(`${API_BASE}/public/settings`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok && json.data) {
      setPublicSettings((prev) => ({ ...prev, ...json.data }));
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    const res = await fetch(`${API_BASE}/public/catalog`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) {
      setBrands(json.data?.brands || []);
      setDeviceTypes(json.data?.employeeDeviceTypes || []);
    }
  }, []);

  const loadBranchData = useCallback(async (code) => {
    const [branchRes, eqRes] = await Promise.all([
      fetch(`${API_BASE}/public/branches/${encodeURIComponent(code)}`),
      fetch(`${API_BASE}/public/branches/${encodeURIComponent(code)}/equipment`),
    ]);
    const [branchJson, eqJson] = await Promise.all([
      branchRes.json().catch(() => ({})),
      eqRes.json().catch(() => ({})),
    ]);
    if (!branchRes.ok || !branchJson?.ok) {
      throw new Error(branchJson?.message || 'Branch not found');
    }
    setBranch(branchJson.data);
    if (eqRes.ok && eqJson?.ok) {
      setExistingEquipment({
        employeeDevices: eqJson.data?.employeeDevices || [],
        branchPrinters: eqJson.data?.branchPrinters || [],
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadCatalog(), loadPublicSettings()]);
        if (branchCode) {
          const stored = readStoredSubmission(branchCode);
          if (stored) {
            if (!cancelled) {
              setSubmissionSummary(stored);
              setDone(true);
            }
          }
          await loadBranchData(branchCode);
          if (!cancelled && !stored) setStep(1);
        }
        const res = await fetch(`${API_BASE}/public/branches`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json?.ok) setBranches(json.data || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branchCode, loadBranchData, loadCatalog, loadPublicSettings]);

  const deviceTypeOptions = useMemo(() => {
    const fromCatalog = deviceTypes.map((t) => ({
      value: t.name,
      label: typeLabel(t.name),
      hint: t.description || t.name,
    }));
    if (fromCatalog.length) return fromCatalog;
    return FALLBACK_DEVICE_TYPES.map((t) => ({
      ...t,
      hint: t.value,
    }));
  }, [deviceTypes]);

  const brandOptions = useMemo(
    () => brands.map((b) => ({ value: b.id, label: b.name })),
    [brands],
  );

  const upsertBranchInList = useCallback((nextBranch) => {
    if (!nextBranch?.id) return;
    setBranches((prev) => {
      if (prev.some((b) => b.id === nextBranch.id)) {
        return prev.map((b) => (b.id === nextBranch.id ? nextBranch : b));
      }
      return [...prev, nextBranch].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const resolveBranchSelection = useCallback(async () => {
    const name = String(branch?.name || '').trim();
    if (!name) {
      throw new Error('Enter your branch name.');
    }

    if (branch?.id) return branch;

    const localMatch = branches.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (localMatch) {
      setBranch(localMatch);
      return localMatch;
    }

    const res = await fetch(`${API_BASE}/public/branches/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || 'Unable to save branch.');
    }

    const resolved = json.data;
    setBranch(resolved);
    upsertBranchInList(resolved);
    return resolved;
  }, [branch, branches, upsertBranchInList]);

  const employeeFullName = `${employee.firstName} ${employee.lastName}`.trim();

  const canNext = () => {
    if (step === 0) return Boolean(String(branch?.name || '').trim().length >= 2);
    if (step === 1) return Boolean(employee.firstName.trim() && employee.lastName.trim());
    if (step === 2) return devices.length > 0 || printers.length > 0 || step < 4;
    if (step === 3) return true;
    return true;
  };

  const goNext = async () => {
    setError('');
    if (step === 0 && !branchCode) {
      setResolvingBranch(true);
      try {
        const resolved = await resolveBranchSelection();
        navigate(`/intake/${resolved.code}`, { replace: true });
      } catch (err) {
        setError(err?.message || 'Unable to continue with this branch.');
      } finally {
        setResolvingBranch(false);
      }
      return;
    }
    if (step === 4) {
      await handleSubmit();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const commitDraftDevice = () => {
    if (!draftDevice.type) {
      setError('Select a device type.');
      return;
    }
    setDevices((prev) => [...prev, { ...draftDevice }]);
    setDraftDevice(emptyDraftDevice());
    setError('');
  };

  const addPrinter = () => {
    setPrinters((prev) => [...prev, emptyPrinter()]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const resolvedBranch = await resolveBranchSelection();
      const payload = {
        branchId: resolvedBranch.id,
        employeeId: null,
        newEmployee: {
          firstName: employee.firstName,
          lastName: employee.lastName,
          jobTitle: employee.jobTitle,
          phone: employee.phoneLocal.trim()
            ? `+260${employee.phoneLocal.trim().replace(/^0+/, '')}`
            : '',
          email: employee.emailLocal.trim()
            ? `${employee.emailLocal.trim()}@goodfellow.co.zm`
            : '',
        },
        devices: devices.map((d) => ({
          type: d.type,
          brandId: d.brandId || null,
          model: d.model,
          serialNumber: d.serialNumber,
        })),
        printers: printers.map((p) => ({
          brandId: p.brandId || null,
          model: p.model,
          serialNumber: p.serialNumber,
        })),
      };

      const res = await fetch(`${API_BASE}/public/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || 'Submission failed');
      }
      const summary = {
        ...buildSubmissionSummary(),
        branch: {
          name: resolvedBranch.name,
          code: resolvedBranch.code,
          city: resolvedBranch.city || '',
        },
      };
      storeSubmission(resolvedBranch.code, summary);
      setSubmissionSummary({ ...summary, submittedAt: new Date().toISOString() });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-100 border-t-cyan-600" />
        <p className="text-sm text-navy-500">Loading form…</p>
      </div>
    );
  }

  if (!publicSettings.intakeEnabled) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-bold text-navy-900">Reporting temporarily unavailable</h2>
        <p className="mt-2 text-sm text-navy-600">
          Branch equipment reporting is currently disabled. Please contact your administrator
          {publicSettings.supportEmail ? ` at ${publicSettings.supportEmail}` : ''}
          {publicSettings.supportPhone ? ` or ${publicSettings.supportPhone}` : ''}.
        </p>
      </div>
    );
  }

  if (done && submissionSummary) {
    return <IntakeSuccessScreen summary={submissionSummary} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepDots step={step} />
      <p className="mb-4 text-center text-sm font-medium text-navy-500">{STEPS[step].label}</p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <p className="shrink-0 text-sm text-navy-600">
            {publicSettings.intakeIntroText || 'Select your branch to report computers and printers in use.'}
          </p>
          {branch?.id ? (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 shrink-0 text-cyan-700" size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-navy-900">{branch.name}</p>
                  <p className="text-sm text-navy-600">{branch.code}{branch.city ? ` · ${branch.city}` : ''}</p>
                </div>
              </div>
              {!branchCode && (
                <button
                  type="button"
                  onClick={() => setBranch(null)}
                  className="mt-3 text-sm font-medium text-cyan-700 hover:text-cyan-800"
                >
                  Change branch
                </button>
              )}
            </div>
          ) : (
            <SearchableBranchField
              branches={branches}
              branch={branch}
              onBranchChange={setBranch}
              placeholder="Branch name"
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-navy-600">Enter your employee details for this branch.</p>
          <div className="space-y-3">
            <Field label="Job title">
              <input
                className={inputClass}
                value={employee.jobTitle}
                onChange={(e) => setEmployee((p) => ({ ...p, jobTitle: e.target.value }))}
                placeholder="Manager, Teller"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  className={inputClass}
                  value={employee.firstName}
                  onChange={(e) => setEmployee((p) => ({ ...p, firstName: e.target.value }))}
                />
              </Field>
              <Field label="Last name" required>
                <input
                  className={inputClass}
                  value={employee.lastName}
                  onChange={(e) => setEmployee((p) => ({ ...p, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Email">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-navy-200 bg-white focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20">
                <input
                  className="min-h-[48px] min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-base text-navy-900 placeholder:text-navy-400 focus:outline-none"
                  value={employee.emailLocal}
                  onChange={(e) => setEmployee((p) => ({
                    ...p,
                    emailLocal: e.target.value.replace(/[@\s]/g, ''),
                  }))}
                  placeholder="your.name"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <span className="flex min-h-[48px] shrink-0 items-center border-l border-navy-200 bg-navy-50 px-3 text-sm font-medium text-navy-600">
                  @goodfellow.co.zm
                </span>
              </div>
            </Field>
            <Field label="Phone">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-navy-200 bg-white focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20">
                <span className="flex min-h-[48px] shrink-0 items-center border-r border-navy-200 bg-navy-50 px-3 text-sm font-medium text-navy-600">
                  +260
                </span>
                <input
                  className="min-h-[48px] min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-base text-navy-900 placeholder:text-navy-400 focus:outline-none"
                  type="tel"
                  value={employee.phoneLocal}
                  onChange={(e) => setEmployee((p) => ({
                    ...p,
                    phoneLocal: e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9),
                  }))}
                  placeholder="97 123 4567"
                  inputMode="numeric"
                />
              </div>
            </Field>
          </div>

          {existingEquipment.employeeDevices.length > 0 && (
            <div className="rounded-xl bg-navy-50 px-4 py-3 text-xs text-navy-600">
              <p className="font-medium text-navy-800 mb-1">Already recorded at this branch</p>
              {existingEquipment.employeeDevices.slice(0, 5).map((d) => (
                <p key={d.id}>· {d.category}: {d.name} ({d.employeeName || 'staff'})</p>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-navy-600">
            Add each device you use. You can add more than one — same type or different types.
          </p>

          <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-navy-900">Add a device</p>
            <SearchableSelect
              label="Device type"
              required
              placeholder="Search type — Monitor, Desktop, Tablet..."
              value={draftDevice.type}
              onChange={(type) => setDraftDevice((p) => ({ ...p, type }))}
              options={deviceTypeOptions}
            />
            <SearchableSelect
              label="Brand"
              placeholder="Search brand — HP, Dell, Lenovo..."
              value={draftDevice.brandId}
              onChange={(brandId) => setDraftDevice((p) => ({ ...p, brandId }))}
              options={brandOptions}
            />
            <Field label="Model (optional)">
              <input
                className={inputClass}
                value={draftDevice.model}
                onChange={(e) => setDraftDevice((p) => ({ ...p, model: e.target.value }))}
                placeholder="e.g. EliteBook 840"
              />
            </Field>
            <Field label="Serial / S/N (optional)">
              <input
                className={inputClass}
                value={draftDevice.serialNumber}
                onChange={(e) => setDraftDevice((p) => ({ ...p, serialNumber: e.target.value }))}
                placeholder="Auto-generated if blank"
              />
            </Field>
            <button
              type="button"
              onClick={() => setSnHelpOpen(true)}
              className="flex w-full items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-left shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                <HelpCircle size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-cyan-900">
                  Can&apos;t find the S/N?
                </span>
                <span className="mt-0.5 block text-xs text-cyan-800">
                  Tap for steps to look it up on your PC while it&apos;s on
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={commitDraftDevice}
              disabled={!draftDevice.type}
              className="w-full min-h-[48px] rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-50"
            >
              + Add to your list
            </button>
          </div>

          {devices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-navy-900">
                Your devices ({devices.length})
              </p>
              {devices.map((device, index) => {
                const Icon = typeIcon(device.type);
                return (
                  <div
                    key={`${device.type}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon size={16} className="shrink-0 text-cyan-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-900">
                          {typeLabel(device.type)}
                          {device.brandId ? ` · ${brandName(device.brandId)}` : ''}
                        </p>
                        <p className="truncate text-xs text-navy-500">
                          {[device.model, device.serialNumber].filter(Boolean).join(' · ') || 'No model / S/N'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDevices((prev) => prev.filter((_, i) => i !== index))}
                      className="shrink-0 text-xs font-medium text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!devices.length && (
            <p className="text-center text-sm text-navy-400 py-2">
              Use the form above to add your first device.
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-navy-600">
            <Printer size={16} className="inline mr-1 text-cyan-600" />
            Branch printers are shared — not tied to one person. Add all printers at this branch.
          </p>
          <button
            type="button"
            onClick={addPrinter}
            className="w-full min-h-[48px] rounded-xl border border-dashed border-navy-200 bg-white text-sm font-medium text-navy-700 hover:border-cyan-400"
          >
            + Add printer
          </button>
          <div className="space-y-3">
            {printers.map((printer, index) => (
              <DeviceCard
                key={`printer-${index}`}
                title="Printer"
                icon={Printer}
                device={printer}
                brands={brands}
                onChange={(next) => setPrinters((prev) => prev.map((p, i) => (i === index ? next : p)))}
                onRemove={() => setPrinters((prev) => prev.filter((_, i) => i !== index))}
                canRemove
              />
            ))}
          </div>
          {existingEquipment.branchPrinters.length > 0 && (
            <div className="rounded-xl bg-navy-50 px-4 py-3 text-xs text-navy-600">
              <p className="font-medium text-navy-800 mb-1">Printers already on file</p>
              {existingEquipment.branchPrinters.map((p) => (
                <p key={p.id}>· {p.name} ({p.sku})</p>
              ))}
            </div>
          )}
          {!printers.length && (
            <p className="text-center text-sm text-navy-400">Skip if none to add — you can submit on the next step.</p>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-navy-100 bg-white p-4 space-y-2">
            <p className="font-semibold text-navy-900 flex items-center gap-2"><Building2 size={16} /> {branch?.name}</p>
            <p className="text-navy-600 flex items-center gap-2">
              <User size={16} />
              {employeeFullName || '—'}
              {employee.jobTitle ? ` · ${employee.jobTitle}` : ''}
            </p>
          </div>
          {devices.length > 0 && (
            <div className="rounded-2xl border border-navy-100 bg-white p-4">
              <p className="font-semibold text-navy-900 mb-2">Your devices ({devices.length})</p>
              {devices.map((d, i) => (
                <p key={i} className="text-navy-600">· {typeLabel(d.type)}{d.brandId ? ` — ${brandName(d.brandId)}` : ''}{d.model ? ` ${d.model}` : ''}</p>
              ))}
            </div>
          )}
          {printers.length > 0 && (
            <div className="rounded-2xl border border-navy-100 bg-white p-4">
              <p className="font-semibold text-navy-900 mb-2">Branch printers ({printers.length})</p>
              {printers.map((p, i) => (
                <p key={i} className="text-navy-600">· Printer{p.brandId ? ` — ${brandName(p.brandId)}` : ''}{p.model ? ` ${p.model}` : ''}</p>
              ))}
            </div>
          )}
          {!devices.length && !printers.length && (
            <p className="text-red-600">Add at least one device or printer before submitting.</p>
          )}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-navy-100 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-3">
          {step > 0 && step < 5 && (
            <button
              type="button"
              onClick={goBack}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-xl border border-navy-200 text-sm font-medium text-navy-700"
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={
              submitting
              || resolvingBranch
              || !canNext()
              || (step === 4 && !devices.length && !printers.length)
            }
            className="flex min-h-[48px] flex-[2] items-center justify-center gap-1 rounded-xl bg-cyan-600 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : resolvingBranch ? 'Saving branch…' : step === 4 ? 'Submit report' : (
              <>Next <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      </div>

      <SerialNumberHelpModal isOpen={snHelpOpen} onClose={() => setSnHelpOpen(false)} />
    </div>
  );
}
