import crypto from 'crypto';
import pool from '../db.js';
import {
  RISK_CONTROLS,
  combineScores,
  controlFindings,
  getControl,
  riskBand,
  scoreControls,
  scoreInfrastructure,
} from '../../shared/riskCatalog.js';

const ASSESSMENT_STATUSES = new Set(['draft', 'completed']);
const FINDING_STATUSES = new Set(['open', 'in_progress', 'accepted', 'resolved']);
const RESPONSES = new Set(['', 'met', 'partial', 'gap', 'na']);

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function mapAssessment(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    assessorName: row.assessor_name || '',
    status: row.status,
    notes: row.notes || '',
    controlScore: row.control_score == null ? null : Number(row.control_score),
    coveragePct: row.coverage_pct == null ? null : Number(row.coverage_pct),
    createdBy: row.created_by || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnswer(row) {
  return {
    controlId: row.control_id,
    response: row.response || '',
    notes: row.notes || '',
    ownerName: row.owner_name || '',
    updatedAt: row.updated_at,
  };
}

function mapFinding(row) {
  return {
    id: row.id,
    assessmentId: row.assessment_id || null,
    signalKey: row.signal_key,
    source: row.source,
    severity: row.severity,
    title: row.title,
    detail: row.detail || '',
    recommendation: row.recommendation || '',
    status: row.status,
    controlId: row.control_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureRiskTables(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id VARCHAR(90) PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      assessor_name VARCHAR(160) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      notes TEXT NULL,
      control_score DECIMAL(5,2) NULL,
      coverage_pct DECIMAL(5,2) NULL,
      created_by VARCHAR(90) NULL,
      completed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_risk_assessments_status (status, updated_at)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS risk_answers (
      assessment_id VARCHAR(90) NOT NULL,
      control_id VARCHAR(80) NOT NULL,
      response VARCHAR(20) NOT NULL DEFAULT '',
      notes TEXT NULL,
      owner_name VARCHAR(160) NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (assessment_id, control_id),
      CONSTRAINT fk_risk_answers_assessment
        FOREIGN KEY (assessment_id) REFERENCES risk_assessments(id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS risk_findings (
      id VARCHAR(90) PRIMARY KEY,
      assessment_id VARCHAR(90) NULL,
      signal_key VARCHAR(140) NOT NULL,
      source VARCHAR(30) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      title VARCHAR(220) NOT NULL,
      detail TEXT NULL,
      recommendation TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      control_id VARCHAR(80) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_risk_findings_signal (signal_key),
      INDEX idx_risk_findings_status (status),
      INDEX idx_risk_findings_assessment (assessment_id)
    )
  `);
}

export async function collectInfrastructureSignals(db = pool) {
  const [[monitors]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(enabled = 1) AS enabled,
      SUM(enabled = 1 AND status = 'up') AS upCount,
      SUM(enabled = 1 AND status = 'down') AS downCount,
      SUM(enabled = 1 AND status = 'unknown') AS unknownCount
    FROM monitor_targets
  `);
  const [[incidents]] = await db.query(`
    SELECT COUNT(*) AS openIncidents
    FROM monitor_incidents
    WHERE ended_at IS NULL
  `);
  const [[devices]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(online_status = 'online') AS onlineCount,
      SUM(online_status != 'online') AS offlineCount
    FROM device_presence
  `);

  return {
    monitors: {
      total: Number(monitors?.total) || 0,
      enabled: Number(monitors?.enabled) || 0,
      up: Number(monitors?.upCount) || 0,
      down: Number(monitors?.downCount) || 0,
      unknown: Number(monitors?.unknownCount) || 0,
    },
    openIncidents: Number(incidents?.openIncidents) || 0,
    devices: {
      total: Number(devices?.total) || 0,
      online: Number(devices?.onlineCount) || 0,
      offline: Number(devices?.offlineCount) || 0,
    },
  };
}

async function listAnswers(assessmentId, db = pool) {
  const [rows] = await db.query(
    `SELECT control_id, response, notes, owner_name, updated_at
     FROM risk_answers
     WHERE assessment_id = ?
     ORDER BY control_id`,
    [assessmentId],
  );
  return rows.map(mapAnswer);
}

async function upsertFinding(db, finding, { assessmentId = null, source }) {
  const signalKey = source === 'control' && assessmentId
    ? `assessment:${assessmentId}:${finding.signalKey}`
    : finding.signalKey;
  const [[existing]] = await db.query(
    'SELECT id, status FROM risk_findings WHERE signal_key = ? LIMIT 1',
    [signalKey],
  );
  if (!existing) {
    await db.query(
      `INSERT INTO risk_findings (
         id, assessment_id, signal_key, source, severity, title, detail, recommendation, status, control_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        generateId('rfind'),
        assessmentId,
        signalKey,
        source,
        finding.severity,
        finding.title,
        finding.detail || '',
        finding.recommendation || '',
        finding.controlId || null,
      ],
    );
    return;
  }
  if (existing.status === 'accepted') {
    await db.query(
      `UPDATE risk_findings
       SET severity = ?, title = ?, detail = ?, recommendation = ?, control_id = ?
       WHERE id = ?`,
      [finding.severity, finding.title, finding.detail || '', finding.recommendation || '', finding.controlId || null, existing.id],
    );
    return;
  }
  await db.query(
    `UPDATE risk_findings
     SET assessment_id = ?, severity = ?, title = ?, detail = ?, recommendation = ?,
         status = 'open', control_id = ?
     WHERE id = ?`,
    [
      assessmentId,
      finding.severity,
      finding.title,
      finding.detail || '',
      finding.recommendation || '',
      finding.controlId || null,
      existing.id,
    ],
  );
}

async function resolveMissing(db, { source, assessmentId = null, activeKeys }) {
  const params = [source];
  let sql = `SELECT id, signal_key, status FROM risk_findings WHERE source = ?`;
  if (assessmentId) {
    sql += ' AND assessment_id = ?';
    params.push(assessmentId);
  } else {
    sql += ' AND assessment_id IS NULL';
  }
  const [rows] = await db.query(sql, params);
  for (const row of rows) {
    if (activeKeys.has(row.signal_key)) continue;
    if (row.status === 'accepted' || row.status === 'resolved') continue;
    await db.query(`UPDATE risk_findings SET status = 'resolved' WHERE id = ?`, [row.id]);
  }
}

export async function syncControlFindings(assessmentId, answers, db = pool) {
  const desired = controlFindings(answers);
  const activeKeys = new Set();
  for (const finding of desired) {
    const signalKey = `assessment:${assessmentId}:${finding.signalKey}`;
    activeKeys.add(signalKey);
    await upsertFinding(db, finding, { assessmentId, source: 'control' });
  }
  await resolveMissing(db, { source: 'control', assessmentId, activeKeys });
}

export async function syncInfrastructureFindings(signals, db = pool) {
  const scored = scoreInfrastructure(signals);
  const activeKeys = new Set();
  for (const finding of scored.findings) {
    activeKeys.add(finding.signalKey);
    await upsertFinding(db, finding, { assessmentId: null, source: 'infrastructure' });
  }
  await resolveMissing(db, { source: 'infrastructure', activeKeys });
  return scored;
}

async function saveScore(assessmentId, answers, db = pool) {
  const scored = scoreControls(answers);
  await db.query(
    `UPDATE risk_assessments
     SET control_score = ?, coverage_pct = ?
     WHERE id = ?`,
    [scored.controlScore, scored.coveragePct, assessmentId],
  );
  return scored;
}

export async function listAssessments(db = pool) {
  const [rows] = await db.query(
    `SELECT * FROM risk_assessments ORDER BY updated_at DESC, created_at DESC LIMIT 50`,
  );
  return rows.map(mapAssessment);
}

export async function getAssessment(id, db = pool) {
  const [[row]] = await db.query('SELECT * FROM risk_assessments WHERE id = ? LIMIT 1', [id]);
  if (!row) throw httpError('Assessment not found.', 404);
  const answers = await listAnswers(id, db);
  const scored = scoreControls(answers);
  return {
    assessment: mapAssessment(row),
    answers,
    controls: RISK_CONTROLS,
    score: scored,
  };
}

export async function createAssessment({ title, assessorName, createdBy }, db = pool) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw httpError('Assessment title is required.');
  if (cleanTitle.length > 180) throw httpError('Assessment title is too long.');
  const id = generateId('risk');
  await db.query(
    `INSERT INTO risk_assessments (id, title, assessor_name, status, created_by, coverage_pct)
     VALUES (?, ?, ?, 'draft', ?, 0)`,
    [id, cleanTitle, String(assessorName || '').trim().slice(0, 160), createdBy || null],
  );
  return getAssessment(id, db);
}

function normalizeAnswers(answers = []) {
  if (!Array.isArray(answers)) throw httpError('Answers must be a list.');
  const seen = new Set();
  const clean = [];
  for (const answer of answers) {
    const controlId = String(answer?.controlId || '').trim();
    if (!getControl(controlId)) throw httpError(`Unknown control ${controlId || '(blank)'}.`);
    if (seen.has(controlId)) throw httpError(`Control ${controlId} was submitted twice.`);
    seen.add(controlId);
    const response = String(answer?.response || '').trim();
    if (!RESPONSES.has(response)) throw httpError(`Invalid response for ${controlId}.`);
    clean.push({
      controlId,
      response,
      notes: String(answer?.notes || '').slice(0, 4000),
      ownerName: String(answer?.ownerName || '').trim().slice(0, 160),
    });
  }
  return clean;
}

export async function updateAssessment(id, payload = {}, db = pool) {
  const [[existing]] = await db.query('SELECT id, status FROM risk_assessments WHERE id = ? LIMIT 1', [id]);
  if (!existing) throw httpError('Assessment not found.', 404);

  const title = payload.title != null ? String(payload.title).trim() : null;
  if (title != null && !title) throw httpError('Assessment title is required.');
  if (title && title.length > 180) throw httpError('Assessment title is too long.');

  const status = payload.status != null ? String(payload.status).trim() : null;
  if (status && !ASSESSMENT_STATUSES.has(status)) throw httpError('Invalid assessment status.');

  const answers = payload.answers != null ? normalizeAnswers(payload.answers) : null;

  if (title || payload.assessorName != null || payload.notes != null || status) {
    await db.query(
      `UPDATE risk_assessments
       SET title = COALESCE(?, title),
           assessor_name = COALESCE(?, assessor_name),
           notes = COALESCE(?, notes),
           status = COALESCE(?, status),
           completed_at = CASE
             WHEN ? = 'completed' THEN COALESCE(completed_at, NOW())
             WHEN ? = 'draft' THEN NULL
             ELSE completed_at
           END
       WHERE id = ?`,
      [
        title,
        payload.assessorName != null ? String(payload.assessorName).trim().slice(0, 160) : null,
        payload.notes != null ? String(payload.notes).slice(0, 8000) : null,
        status,
        status,
        status,
        id,
      ],
    );
  }

  if (answers) {
    for (const answer of answers) {
      await db.query(
        `INSERT INTO risk_answers (assessment_id, control_id, response, notes, owner_name)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           response = VALUES(response),
           notes = VALUES(notes),
           owner_name = VALUES(owner_name)`,
        [id, answer.controlId, answer.response, answer.notes, answer.ownerName],
      );
    }
    const stored = await listAnswers(id, db);
    await saveScore(id, stored, db);
    await syncControlFindings(id, stored, db);
  }

  return getAssessment(id, db);
}

export async function listFindings({ status = '', limit = 100 } = {}, db = pool) {
  const params = [];
  let sql = 'SELECT * FROM risk_findings';
  if (status) {
    if (!FINDING_STATUSES.has(status)) throw httpError('Invalid finding status.');
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY FIELD(status, \'open\', \'in_progress\', \'accepted\', \'resolved\'), FIELD(severity, \'critical\', \'high\', \'medium\', \'low\'), updated_at DESC LIMIT ?';
  params.push(Math.min(200, Math.max(1, Number(limit) || 100)));
  const [rows] = await db.query(sql, params);
  return rows.map(mapFinding);
}

export async function updateFindingStatus(id, status, db = pool) {
  const next = String(status || '').trim();
  if (!FINDING_STATUSES.has(next)) throw httpError('Invalid finding status.');
  const [result] = await db.query('UPDATE risk_findings SET status = ? WHERE id = ?', [next, id]);
  if (!result.affectedRows) throw httpError('Finding not found.', 404);
  const [[row]] = await db.query('SELECT * FROM risk_findings WHERE id = ? LIMIT 1', [id]);
  return mapFinding(row);
}

async function latestAssessment(db = pool) {
  const [[completed]] = await db.query(
    `SELECT * FROM risk_assessments WHERE status = 'completed' ORDER BY completed_at DESC, updated_at DESC LIMIT 1`,
  );
  if (completed) return mapAssessment(completed);
  const [[draft]] = await db.query(
    `SELECT * FROM risk_assessments ORDER BY updated_at DESC LIMIT 1`,
  );
  return mapAssessment(draft);
}

export async function getRiskOverview(db = pool) {
  const signals = await collectInfrastructureSignals(db);
  const infrastructure = await syncInfrastructureFindings(signals, db);
  const current = await latestAssessment(db);
  let answers = [];
  let controlScoreResult = scoreControls([]);
  if (current) {
    answers = await listAnswers(current.id, db);
    controlScoreResult = scoreControls(answers);
  }
  const combined = combineScores(controlScoreResult.controlScore, infrastructure.score);
  const findings = await listFindings({}, db);
  const openFindings = findings.filter((finding) => finding.status === 'open' || finding.status === 'in_progress');
  return {
    band: riskBand(combined.overall),
    overallScore: combined.overall,
    basis: combined.basis,
    controlScore: controlScoreResult.controlScore,
    coveragePct: controlScoreResult.coveragePct,
    functions: controlScoreResult.functions,
    infrastructureScore: infrastructure.score,
    signals,
    assessment: current,
    assessments: await listAssessments(db),
    findings: openFindings,
    findingCounts: {
      open: findings.filter((finding) => finding.status === 'open').length,
      inProgress: findings.filter((finding) => finding.status === 'in_progress').length,
      accepted: findings.filter((finding) => finding.status === 'accepted').length,
      resolved: findings.filter((finding) => finding.status === 'resolved').length,
    },
  };
}
