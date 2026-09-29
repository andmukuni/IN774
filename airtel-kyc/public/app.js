const form = document.querySelector('#lookup-form');
const msisdnInput = document.querySelector('#msisdn');
const hint = document.querySelector('#msisdn-hint');
const submit = document.querySelector('#submit');
const resultEmpty = document.querySelector('#result-empty');
const result = document.querySelector('#result');
const historyEl = document.querySelector('#history');
const statusLine = document.querySelector('#status-line');
const mockBanner = document.querySelector('#mock-banner');
const setupBanner = document.querySelector('#setup-banner');
const connectionNote = document.querySelector('#connection-note');
const connectionButton = document.querySelector('#connection');
const logoutButton = document.querySelector('#logout');
const login = document.querySelector('#login');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');

const verdictLabel = {
  verified: 'Verified',
  barred: 'Barred',
  not_registered: 'Not registered',
  not_verified: 'Not verified',
  error: 'Could not check',
};

let status = null;
let lastRecord = null;

function parseZambiaMsisdn(input) {
  let digits = String(input ?? '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('260')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[79]\d{8}$/.test(digits)) return null;
  const prefix = digits.slice(0, 2);
  return {
    national: digits,
    isAirtelPrefix: ['97', '77', '57'].includes(prefix),
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not returned';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/session') {
    showLogin();
  }
  return { response, body };
}

function showLogin() {
  if (typeof login.showModal === 'function' && !login.open) login.showModal();
}

function hideLogin() {
  loginError.hidden = true;
  if (login.open) login.close();
}

function renderStatus() {
  if (!status) {
    statusLine.textContent = 'Status unavailable';
    return;
  }
  const env = status.environment === 'production' ? 'Production' : 'Staging';
  const creds = status.credentialsConfigured ? 'credentials saved' : 'credentials missing';
  statusLine.textContent = `${env} · ${status.country} · ${status.currency} · ${creds}`;
  mockBanner.hidden = !status.mock;
  logoutButton.hidden = !status.authRequired;
  if (!status.mock && !status.credentialsConfigured) {
    setupBanner.hidden = false;
    setupBanner.textContent = 'Add AIRTEL_CLIENT_ID and AIRTEL_CLIENT_SECRET to airtel-kyc/.env, then restart. Until then, lookups cannot reach Airtel.';
    submit.disabled = true;
  } else {
    setupBanner.hidden = true;
    submit.disabled = false;
  }
}

function renderResult(record) {
  lastRecord = record;
  resultEmpty.hidden = true;
  result.hidden = false;
  result.replaceChildren();

  const verdict = record.verdict || 'error';
  result.append(
    el('p', `verdict ${verdict}`, verdictLabel[verdict] || verdict),
    el('p', 'summary', record.summary || 'No details returned.'),
  );

  const rows = [
    ['Name', record.subscriber?.fullName || 'Not returned'],
    ['MSISDN', record.subscriber?.msisdn || record.input?.national || '—'],
    ['Sent to Airtel', record.queriedMsisdn || '—'],
    ['Grade', record.subscriber?.grade || 'Not returned'],
    ['Registration', record.subscriber?.registrationStatus || 'Not returned'],
    ['PIN set', yesNo(record.subscriber?.isPinSet)],
    ['Barred', yesNo(record.subscriber?.isBarred)],
    ['Airtel message', record.airtel?.message || '—'],
    ['Result code', record.airtel?.resultCode || '—'],
  ];
  const list = document.createElement('dl');
  for (const [label, value] of rows) {
    list.append(el('dt', '', label), el('dd', '', value));
  }
  result.append(list);

  if (record.input?.prefixWarning) {
    result.append(el('p', 'hint', record.input.prefixWarning));
  }

  const again = el('button', 'ghost again', 'Check this number again');
  again.type = 'button';
  again.addEventListener('click', () => {
    msisdnInput.value = record.input?.local || record.queriedMsisdn || '';
    form.requestSubmit();
  });
  result.append(again);
}

function renderHistory(records) {
  historyEl.replaceChildren();
  if (!records.length) {
    historyEl.append(el('p', 'blank', 'Checks you run on this server will be listed here.'));
    return;
  }
  const list = el('div', 'history-list');
  for (const record of records) {
    const button = el('button', 'history-item');
    button.type = 'button';
    const text = el('span');
    text.append(el('strong', '', record.subscriber?.fullName || record.input?.local || record.queriedMsisdn || 'Unknown'));
    const when = record.checkedAt ? new Date(record.checkedAt).toLocaleString() : '';
    text.append(document.createTextNode(when));
    button.append(text, el('span', `verdict ${record.verdict}`, verdictLabel[record.verdict] || record.verdict));
    button.addEventListener('click', () => renderResult(record));
    list.append(button);
  }
  historyEl.append(list);
}

function updateHint() {
  const parsed = parseZambiaMsisdn(msisdnInput.value);
  if (!msisdnInput.value.trim()) {
    hint.classList.remove('error');
    hint.textContent = 'Use 097, 077, or 057, with or without the country code.';
    return;
  }
  if (!parsed) {
    hint.classList.add('error');
    hint.textContent = 'Enter a Zambian mobile number, for example 0971234567.';
    return;
  }
  hint.classList.remove('error');
  hint.textContent = parsed.isAirtelPrefix
    ? `Ready to check ${parsed.national}.`
    : 'This prefix is outside the usual Airtel ranges. You can still run the lookup.';
}

async function loadStatus() {
  const { response, body } = await api('/api/status');
  if (response.status === 401) return;
  if (!response.ok) throw new Error(body.error || 'Could not load status.');
  status = body;
  renderStatus();
}

async function loadHistory() {
  const { response, body } = await api('/api/verifications?limit=20');
  if (!response.ok) {
    if (response.status !== 401) historyEl.replaceChildren(el('p', 'blank', body.error || 'Could not load recent checks.'));
    return;
  }
  renderHistory(body.data || []);
}

async function boot() {
  const session = await api('/api/session');
  if (session.body.authRequired && !session.body.authenticated) {
    showLogin();
    return;
  }
  hideLogin();
  await loadStatus();
  await loadHistory();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  connectionNote.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Checking…';
  try {
    const { response, body } = await api('/api/verify', {
      method: 'POST',
      body: JSON.stringify({ msisdn: msisdnInput.value }),
    });
    if (response.status === 401) return;
    if (!body.verdict) {
      resultEmpty.hidden = true;
      result.hidden = false;
      result.replaceChildren(
        el('p', 'verdict error', 'Could not check'),
        el('p', 'summary', body.error || 'The lookup did not complete.'),
      );
      return;
    }
    renderResult(body);
    await loadHistory();
  } catch {
    resultEmpty.hidden = true;
    result.hidden = false;
    result.replaceChildren(
      el('p', 'verdict error', 'Could not check'),
      el('p', 'summary', 'The verifier could not be reached.'),
    );
  } finally {
    submit.textContent = 'Verify number';
    if (status?.mock || status?.credentialsConfigured) submit.disabled = false;
  }
});

msisdnInput.addEventListener('input', updateHint);

connectionButton.addEventListener('click', async () => {
  connectionButton.disabled = true;
  connectionNote.textContent = 'Contacting Airtel…';
  try {
    const { response, body } = await api('/api/connection', { method: 'POST' });
    if (response.status === 401) {
      connectionNote.textContent = '';
      return;
    }
    connectionNote.textContent = body.ok
      ? (body.mock ? 'Mock mode is active, so no token was requested.' : `Connected. Token expires in ${body.expiresIn} seconds.`)
      : (body.error || 'Connection failed.');
  } catch {
    connectionNote.textContent = 'The verifier could not be reached.';
  } finally {
    connectionButton.disabled = false;
  }
});

document.querySelector('#refresh-history').addEventListener('click', loadHistory);

logoutButton.addEventListener('click', async () => {
  await api('/api/session', { method: 'DELETE' });
  showLogin();
});

login.addEventListener('cancel', (event) => event.preventDefault());

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const accessKey = new FormData(loginForm).get('accessKey');
  const { response, body } = await api('/api/session', {
    method: 'POST',
    body: JSON.stringify({ accessKey }),
  });
  if (!response.ok) {
    loginError.hidden = false;
    loginError.textContent = body.error || 'Sign-in failed.';
    return;
  }
  loginForm.reset();
  hideLogin();
  await loadStatus();
  await loadHistory();
});

boot().catch(() => {
  statusLine.textContent = 'Could not reach the verifier.';
});
