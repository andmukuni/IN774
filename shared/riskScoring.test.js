import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RISK_CONTROLS,
  combineScores,
  controlFindings,
  riskBand,
  scoreControls,
  scoreInfrastructure,
} from './riskCatalog.js';

test('a fully met questionnaire scores 100 with full coverage', () => {
  const answers = RISK_CONTROLS.map((control) => ({ controlId: control.id, response: 'met' }));
  const result = scoreControls(answers);
  assert.equal(result.controlScore, 100);
  assert.equal(result.coveragePct, 100);
  assert.equal(result.answered, RISK_CONTROLS.length);
});

test('not applicable controls drop out of the score', () => {
  const answers = [
    { controlId: 'ID-01', response: 'met' },
    { controlId: 'ID-02', response: 'na' },
  ];
  const result = scoreControls(answers);
  assert.equal(result.naCount, 1);
  assert.ok(result.controlScore > 0);
  assert.ok(result.coveragePct < 100);
});

test('gaps on heavy controls become high findings', () => {
  const findings = controlFindings([{ controlId: 'PR-02', response: 'gap' }]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'high');
  assert.match(findings[0].recommendation, /second factor|admin/i);
});

test('missing monitors and open incidents lower the infrastructure score', () => {
  const healthy = scoreInfrastructure({
    monitors: { enabled: 3, down: 0, unknown: 0 },
    openIncidents: 0,
    devices: { total: 4, offline: 0 },
  });
  const exposed = scoreInfrastructure({
    monitors: { enabled: 0, down: 0, unknown: 0 },
    openIncidents: 2,
    devices: { total: 4, offline: 3 },
  });
  assert.equal(healthy.score, 100);
  assert.ok(exposed.score < 60);
  assert.ok(exposed.findings.some((finding) => finding.signalKey === 'infra:no-monitors'));
});

test('combined score weights the questionnaire above live checks', () => {
  const combined = combineScores(100, 70);
  assert.equal(combined.overall, 91);
  assert.equal(combined.basis, 'combined');
  assert.equal(combineScores(null, 70).basis, 'infrastructure');
});

test('risk bands match the published thresholds', () => {
  assert.equal(riskBand(90).key, 'low');
  assert.equal(riskBand(70).key, 'moderate');
  assert.equal(riskBand(50).key, 'high');
  assert.equal(riskBand(49).key, 'critical');
  assert.equal(riskBand(null).key, 'unknown');
});
