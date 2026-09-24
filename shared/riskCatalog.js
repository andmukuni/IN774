/**
 * Cybersecurity self-assessment catalog and scoring.
 * Answers describe the organization's own controls. Guidance stays at the
 * policy and operations level — it does not describe how to attack systems.
 */

export const RISK_FUNCTIONS = [
  { key: 'identify', label: 'Identify', summary: 'Know the systems, data, and accounts that matter.' },
  { key: 'protect', label: 'Protect', summary: 'Limit who can change production systems and data.' },
  { key: 'detect', label: 'Detect', summary: 'Notice outages and unexpected access while they are still small.' },
  { key: 'respond', label: 'Respond', summary: 'Have named people and first steps when something goes wrong.' },
  { key: 'recover', label: 'Recover', summary: 'Be able to restore priority systems from a tested backup.' },
];

export const RISK_RESPONSES = {
  met: { label: 'In place', score: 1 },
  partial: { label: 'Partial', score: 0.5 },
  gap: { label: 'Not in place', score: 0 },
  na: { label: 'Not applicable', score: null },
};

export const RISK_CONTROLS = [
  {
    id: 'ID-01',
    function: 'identify',
    weight: 3,
    title: 'Asset inventory',
    prompt: 'Servers, databases, and company endpoints that store or process business data are listed, with an owner.',
    guidance: 'Keep the list in the same place the team already uses for inventory. Include branch systems, not only the head office.',
  },
  {
    id: 'ID-02',
    function: 'identify',
    weight: 3,
    title: 'Sensitive data identified',
    prompt: 'Customer, employee, and financial data stores are named, and staff know which systems hold them.',
    guidance: 'A short classification (public, internal, restricted) is enough. Note where backups of restricted data live.',
  },
  {
    id: 'ID-03',
    function: 'identify',
    weight: 2,
    title: 'External dependencies listed',
    prompt: 'Vendors and branch systems that hold company data or can reach the internal network are written down.',
    guidance: 'Include hosting, email, accounting, and any remote-support tools.',
  },
  {
    id: 'ID-04',
    function: 'identify',
    weight: 2,
    title: 'Privileged accounts inventoried',
    prompt: 'Shared and individual administrator accounts for apps, databases, and infrastructure are listed.',
    guidance: 'Record who can approve a new admin account. Remove accounts when the person changes role.',
  },
  {
    id: 'PR-01',
    function: 'protect',
    weight: 3,
    title: 'Unique administrative accounts',
    prompt: 'Administrators sign in with their own accounts. Shared passwords are not the normal way to operate production.',
    guidance: 'Break-glass accounts, if any, are sealed and reviewed after each use.',
  },
  {
    id: 'PR-02',
    function: 'protect',
    weight: 3,
    title: 'Multi-factor authentication',
    prompt: 'Admin consoles and remote access require a second factor, not only a password.',
    guidance: 'Start with email, VPN or remote desktop, and this admin app. Record exceptions with an expiry.',
  },
  {
    id: 'PR-03',
    function: 'protect',
    weight: 2,
    title: 'Least privilege',
    prompt: 'People receive only the roles they need. Inventory staff cannot change monitoring or access control unless that is their job.',
    guidance: 'Use the roles already in Access Control. Review them when someone changes team.',
  },
  {
    id: 'PR-04',
    function: 'protect',
    weight: 3,
    title: 'Backups separated from production',
    prompt: 'Critical databases have scheduled backups stored somewhere other than the server that runs them.',
    guidance: 'Note the backup location, how often it runs, and who is allowed to restore.',
  },
  {
    id: 'PR-05',
    function: 'protect',
    weight: 2,
    title: 'Company devices protected',
    prompt: 'Company PCs are expected to have disk encryption and endpoint protection, and lost devices are reported.',
    guidance: 'The presence agent shows which machines check in. Pair that list with the device policy.',
  },
  {
    id: 'PR-06',
    function: 'protect',
    weight: 2,
    title: 'Changes are deliberate',
    prompt: 'Production configuration, firewall, and access changes have a requester and an approver, even if the process is lightweight.',
    guidance: 'A ticket or email thread is enough. Emergency changes are written up afterwards.',
  },
  {
    id: 'DE-01',
    function: 'detect',
    weight: 3,
    title: 'Critical services are monitored',
    prompt: 'Servers and databases the business cannot run without are checked by Servers & DB Monitor, with an alert recipient.',
    guidance: 'A target that stays Unknown has not proven it is watched. Down targets should page a named person.',
  },
  {
    id: 'DE-02',
    function: 'detect',
    weight: 2,
    title: 'Endpoint visibility',
    prompt: 'Company PCs that should be online report through Devices Online, or an equivalent check-in.',
    guidance: 'Offline machines are investigated when they stay dark longer than the branch expects.',
  },
  {
    id: 'DE-03',
    function: 'detect',
    weight: 2,
    title: 'Admin activity is reviewed',
    prompt: 'Someone looks at failed admin sign-ins and permission changes on a set schedule.',
    guidance: 'Weekly is a reasonable start. Record who reviews them and where notes go.',
  },
  {
    id: 'DE-04',
    function: 'detect',
    weight: 2,
    title: 'Alerts have an owner',
    prompt: 'Monitor and backup failure alerts go to a person or mailbox that is checked, not only to an unattended inbox.',
    guidance: 'Name a primary and a backup. Test that a down check actually reaches them.',
  },
  {
    id: 'RS-01',
    function: 'respond',
    weight: 3,
    title: 'Incident contacts',
    prompt: 'A short list names who to call for an outage, a lost laptop, or a suspected account compromise, including after hours.',
    guidance: 'Include management, IT, and the branch contact. Keep phone numbers current.',
  },
  {
    id: 'RS-02',
    function: 'respond',
    weight: 3,
    title: 'Account disable path',
    prompt: 'Staff know how to disable a lost or suspected account the same day, including admin and email access.',
    guidance: 'Write the steps the team already uses. Do not include passwords in the assessment notes.',
  },
  {
    id: 'RS-03',
    function: 'respond',
    weight: 2,
    title: 'Notification owner',
    prompt: 'One person decides whether customers or branches need to be told about an incident, and by when.',
    guidance: 'The decision owner can be different from the person fixing the system.',
  },
  {
    id: 'RC-01',
    function: 'recover',
    weight: 3,
    title: 'Restore has been tested',
    prompt: 'A backup of a critical database has been restored in the last 12 months, and the date is recorded.',
    guidance: 'A restore to a non-production database counts. Note what failed and what was fixed.',
  },
  {
    id: 'RC-02',
    function: 'recover',
    weight: 2,
    title: 'Recovery priorities',
    prompt: 'The team has written which systems come back first and a rough time target for each.',
    guidance: 'Three tiers are enough: must run today, can wait a day, can wait longer.',
  },
  {
    id: 'RC-03',
    function: 'recover',
    weight: 1,
    title: 'Outage lessons recorded',
    prompt: 'After a significant outage, the team writes what happened, what restored service, and what will change.',
    guidance: 'Use the monitor incident history as the starting list. Keep the write-up short.',
  },
];

const CONTROL_BY_ID = new Map(RISK_CONTROLS.map((control) => [control.id, control]));

export function riskBand(score) {
  if (score == null || Number.isNaN(Number(score))) {
    return { key: 'unknown', label: 'Not assessed' };
  }
  const value = Number(score);
  if (value >= 85) return { key: 'low', label: 'Low' };
  if (value >= 70) return { key: 'moderate', label: 'Moderate' };
  if (value >= 50) return { key: 'high', label: 'High' };
  return { key: 'critical', label: 'Critical' };
}

export function scoreControls(answers = []) {
  const byId = new Map();
  for (const answer of answers) {
    if (answer?.controlId) byId.set(answer.controlId, answer);
  }

  const functions = {};
  for (const fn of RISK_FUNCTIONS) {
    functions[fn.key] = {
      key: fn.key,
      label: fn.label,
      weight: 0,
      earned: 0,
      applicable: 0,
      answered: 0,
      gaps: 0,
      partials: 0,
      score: null,
    };
  }

  let weightSum = 0;
  let earned = 0;
  let applicable = 0;
  let answeredApplicable = 0;
  let naCount = 0;

  for (const control of RISK_CONTROLS) {
    const bucket = functions[control.function];
    const response = String(byId.get(control.id)?.response || '').trim();
    if (response === 'na') {
      naCount += 1;
      continue;
    }
    applicable += 1;
    bucket.applicable += 1;
    if (!RISK_RESPONSES[response] || response === '') continue;
    const points = RISK_RESPONSES[response].score;
    const weight = control.weight || 1;
    weightSum += weight;
    earned += points * weight;
    answeredApplicable += 1;
    bucket.weight += weight;
    bucket.earned += points * weight;
    bucket.answered += 1;
    if (response === 'gap') bucket.gaps += 1;
    if (response === 'partial') bucket.partials += 1;
  }

  for (const bucket of Object.values(functions)) {
    bucket.score = bucket.weight === 0 ? null : Math.round((bucket.earned / bucket.weight) * 100);
  }

  const controlScore = weightSum === 0 ? null : Math.round((earned / weightSum) * 100);
  const coveragePct = applicable === 0 ? 0 : Math.round((answeredApplicable / applicable) * 100);

  return {
    controlScore,
    coveragePct,
    applicable,
    answered: answeredApplicable,
    naCount,
    functions: RISK_FUNCTIONS.map((fn) => functions[fn.key]),
  };
}

export function scoreInfrastructure(signals = {}) {
  const monitors = signals.monitors || {};
  const devices = signals.devices || {};
  const enabled = Number(monitors.enabled) || 0;
  const down = Number(monitors.down) || 0;
  const unknown = Number(monitors.unknown) || 0;
  const openIncidents = Number(signals.openIncidents) || 0;
  const deviceTotal = Number(devices.total) || 0;
  const deviceOffline = Number(devices.offline) || 0;

  let score = 100;
  const findings = [];

  if (enabled === 0) {
    score -= 25;
    findings.push({
      signalKey: 'infra:no-monitors',
      severity: 'high',
      title: 'No infrastructure checks are configured',
      detail: 'Servers & DB Monitor has no enabled targets, so outages of critical systems would not show up here.',
      recommendation: 'Add the production app, database, and any branch systems the business cannot run without. Set an alert recipient.',
    });
  } else if (down > 0) {
    score -= Math.min(40, down * 12);
    findings.push({
      signalKey: 'infra:monitors-down',
      severity: down >= 2 ? 'high' : 'medium',
      title: `${down} monitored target${down === 1 ? ' is' : 's are'} down`,
      detail: 'Enabled checks are currently failing. Treat this as an availability exposure until the checks recover.',
      recommendation: 'Open Servers & DB Monitor, confirm the failure is real, and assign an owner until the target is up.',
    });
  }

  if (unknown > 0) {
    score -= Math.min(15, unknown * 5);
    findings.push({
      signalKey: 'infra:monitors-unknown',
      severity: 'low',
      title: `${unknown} enabled target${unknown === 1 ? ' has' : 's have'} never reported a result`,
      detail: 'Unknown status means the check has not proven the service is reachable.',
      recommendation: 'Run a check on each Unknown target and confirm the interval is short enough to notice an outage.',
    });
  }

  if (openIncidents > 0) {
    score -= Math.min(24, openIncidents * 8);
    findings.push({
      signalKey: 'infra:open-incidents',
      severity: openIncidents >= 2 ? 'high' : 'medium',
      title: `${openIncidents} monitor incident${openIncidents === 1 ? ' is' : 's are'} still open`,
      detail: 'An incident stays open until the target recovers. Open incidents mean a recorded outage has not closed.',
      recommendation: 'Review the open incidents and either restore the service or record why the target should be disabled.',
    });
  }

  if (deviceTotal === 0) {
    score -= 10;
    findings.push({
      signalKey: 'infra:no-devices',
      severity: 'low',
      title: 'No company devices are reporting presence',
      detail: 'Devices Online has no enrolled machines, so a missing endpoint would not be visible.',
      recommendation: 'Enroll company PCs with the presence agent, starting with machines that hold inventory or finance work.',
    });
  } else {
    const ratio = deviceOffline / deviceTotal;
    if (ratio >= 0.5) {
      score -= 20;
      findings.push({
        signalKey: 'infra:devices-offline',
        severity: 'medium',
        title: 'Most enrolled devices are offline',
        detail: `${deviceOffline} of ${deviceTotal} enrolled devices are offline.`,
        recommendation: 'Confirm whether those machines should still be enrolled. Investigate any that are expected to be on.',
      });
    } else if (ratio >= 0.25) {
      score -= 10;
      findings.push({
        signalKey: 'infra:devices-offline',
        severity: 'low',
        title: 'A large share of enrolled devices are offline',
        detail: `${deviceOffline} of ${deviceTotal} enrolled devices are offline.`,
        recommendation: 'Compare the offline list with the branch roster and follow up on machines that should be checking in.',
      });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    findings,
  };
}

export function combineScores(controlScore, infrastructureScore) {
  if (controlScore == null) {
    return {
      overall: infrastructureScore,
      basis: 'infrastructure',
    };
  }
  return {
    overall: Math.round((controlScore * 0.7) + (infrastructureScore * 0.3)),
    basis: 'combined',
  };
}

export function controlFindings(answers = []) {
  const findings = [];
  const byId = new Map(answers.map((answer) => [answer.controlId, answer]));
  for (const control of RISK_CONTROLS) {
    const response = String(byId.get(control.id)?.response || '').trim();
    if (response !== 'gap' && response !== 'partial') continue;
    const severity = response === 'gap'
      ? (control.weight >= 3 ? 'high' : 'medium')
      : (control.weight >= 3 ? 'medium' : 'low');
    findings.push({
      controlId: control.id,
      signalKey: `control:${control.id}`,
      severity,
      title: `${control.id} ${control.title} is ${response === 'gap' ? 'not in place' : 'only partial'}`,
      detail: control.prompt,
      recommendation: control.guidance,
    });
  }
  return findings;
}

export function getControl(controlId) {
  return CONTROL_BY_ID.get(controlId) || null;
}
