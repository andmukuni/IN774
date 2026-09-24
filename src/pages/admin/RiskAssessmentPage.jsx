import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { Card, FormField, LoadingButton, PageHeader, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { RISK_FUNCTIONS, RISK_RESPONSES, scoreControls } from '../../../shared/riskCatalog.js';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';

const API_BASE = getApiBase();

const RESPONSE_OPTIONS = [
  { value: '', label: 'Not answered' },
  ...Object.entries(RISK_RESPONSES).map(([value, meta]) => ({ value, label: meta.label })),
];

function emptyAnswer(controlId) {
  return { controlId, response: '', notes: '', ownerName: '' };
}

export default function RiskAssessmentPage() {
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('risk.manage');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [controls, setControls] = useState([]);
  const [title, setTitle] = useState('');
  const [assessorName, setAssessorName] = useState('');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/risk/assessments/${id}`, {
        headers: getAdminAuthHeaders(),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not load the assessment.');
      const next = {};
      for (const control of body.data.controls) next[control.id] = emptyAnswer(control.id);
      for (const answer of body.data.answers) next[answer.controlId] = { ...emptyAnswer(answer.controlId), ...answer };
      setAssessment(body.data.assessment);
      setControls(body.data.controls);
      setTitle(body.data.assessment.title);
      setAssessorName(body.data.assessment.assessorName);
      setNotes(body.data.assessment.notes || '');
      setAnswers(next);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const preview = useMemo(
    () => scoreControls(Object.values(answers)),
    [answers],
  );

  function updateAnswer(controlId, patch) {
    setAnswers((current) => ({
      ...current,
      [controlId]: { ...current[controlId], ...patch },
    }));
  }

  async function save(status) {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/risk/assessments/${id}`, {
        method: 'PUT',
        headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          assessorName,
          notes,
          status,
          answers: Object.values(answers),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not save the assessment.');
      setAssessment(body.data.assessment);
      toast.success(status === 'completed' ? 'Assessment completed.' : 'Draft saved.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!assessment) {
    return (
      <PageHeader
        title="Assessment"
        subtitle="This assessment could not be loaded."
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Cyber risk', to: '/admin/risk' }]}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title={title || 'Assessment'}
        subtitle={`Control score ${preview.controlScore ?? '—'} · ${preview.coveragePct}% answered · ${assessment.status}`}
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Cyber risk', to: '/admin/risk' },
          { label: assessment.title },
        ]}
        actions={canManage ? (
          <div className="flex items-center gap-2">
            <LoadingButton
              loading={saving}
              icon={Save}
              onClick={() => save('draft')}
              className="rounded-xl border border-navy-200 px-3 py-2 text-sm font-medium text-navy-700"
            >
              Save draft
            </LoadingButton>
            <LoadingButton
              loading={saving}
              onClick={() => save('completed')}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Complete
            </LoadingButton>
          </div>
        ) : null}
      />

      <Card className="mb-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canManage} />
          <FormField label="Assessor" name="assessorName" value={assessorName} onChange={(event) => setAssessorName(event.target.value)} disabled={!canManage} />
        </div>
        <div className="mt-4">
          <FormField
            label="Notes"
            name="notes"
            textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!canManage}
            helpText="Record scope, exceptions, and the date of the last restore test. Do not store passwords."
          />
        </div>
      </Card>

      <div className="space-y-4">
        {RISK_FUNCTIONS.map((fn) => {
          const bucket = preview.functions.find((item) => item.key === fn.key);
          const items = controls.filter((control) => control.function === fn.key);
          return (
            <Card
              key={fn.key}
              title={fn.label}
              subtitle={`${fn.summary} Score ${bucket?.score ?? '—'}.`}
            >
              <div className="space-y-5">
                {items.map((control) => {
                  const answer = answers[control.id] || emptyAnswer(control.id);
                  return (
                    <div key={control.id} className="rounded-xl border border-navy-100 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-navy-900">
                          <span className="mr-2 text-xs font-semibold text-cyan-700">{control.id}</span>
                          {control.title}
                        </p>
                        <span className="text-xs text-navy-400">Weight {control.weight}</span>
                      </div>
                      <p className="mt-1 text-sm text-navy-600">{control.prompt}</p>
                      <p className="mt-1 text-xs text-navy-400">{control.guidance}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <FormField
                          label="Response"
                          name={`${control.id}-response`}
                          type="select"
                          value={answer.response}
                          options={RESPONSE_OPTIONS}
                          disabled={!canManage}
                          onChange={(event) => updateAnswer(control.id, { response: event.target.value })}
                        />
                        <FormField
                          label="Owner"
                          name={`${control.id}-owner`}
                          value={answer.ownerName}
                          disabled={!canManage}
                          onChange={(event) => updateAnswer(control.id, { ownerName: event.target.value })}
                        />
                      </div>
                      <div className="mt-3">
                        <FormField
                          label="Evidence note"
                          name={`${control.id}-notes`}
                          textarea
                          rows={2}
                          value={answer.notes}
                          disabled={!canManage}
                          onChange={(event) => updateAnswer(control.id, { notes: event.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-navy-400">
        <Link to="/admin/risk" className="text-cyan-700 hover:underline">Back to posture</Link>
      </p>
    </div>
  );
}
