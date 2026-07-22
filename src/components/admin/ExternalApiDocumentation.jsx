import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import {
  EXTERNAL_API_DOC_GROUPS,
  EXTERNAL_API_ENDPOINT_DOCS,
} from '../../../shared/externalApiDocs.js';

function MethodBadge({ method }) {
  const m = String(method || 'GET').toUpperCase();
  const tone = m === 'POST'
    ? 'bg-blue-50 text-blue-700'
    : m === 'PUT' || m === 'PATCH'
      ? 'bg-amber-50 text-amber-700'
      : m === 'DELETE'
        ? 'bg-red-50 text-red-700'
        : 'bg-emerald-50 text-emerald-700';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {m}
    </span>
  );
}

function ScopeBadge({ scope }) {
  if (scope === 'Public') {
    return (
      <span className="inline-flex rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-600">
        Public
      </span>
    );
  }
  return (
    <code className="rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-700">{scope}</code>
  );
}

function formatRequestLine(endpoint, baseUrl) {
  const path = String(endpoint.path || '').replace(/:([A-Za-z_]+)/g, '{$1}');
  return `${endpoint.method} ${baseUrl}${path}`;
}

function EndpointDetail({ endpoint, baseUrl, onCopy }) {
  const requestLine = formatRequestLine(endpoint, baseUrl);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-sm text-navy-900">{endpoint.path}</code>
          <ScopeBadge scope={endpoint.scope} />
        </div>
        <p className="mt-2 text-sm text-navy-600">{endpoint.summary}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Request</p>
          <button
            type="button"
            onClick={() => onCopy?.(requestLine, 'Request copied')}
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-600"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs text-cyan-100">
          {requestLine}
        </pre>
      </div>

      {endpoint.queryParams?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Query parameters</p>
          <div className="overflow-x-auto rounded-lg border border-navy-100">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-navy-50 text-navy-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 bg-white">
                {endpoint.queryParams.map((param) => (
                  <tr key={param.name}>
                    <td className="px-3 py-2 font-mono text-navy-800">{param.name}</td>
                    <td className="px-3 py-2 text-navy-500">{param.type}</td>
                    <td className="px-3 py-2 text-navy-600">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Example response</p>
        <pre className="overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-cyan-100">
          {JSON.stringify(endpoint.responseExample, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ResourceEndpointPanel({ endpoints, baseUrl, onCopy }) {
  const [selectedId, setSelectedId] = useState(endpoints[0]?.id || '');

  useEffect(() => {
    if (!endpoints.some((e) => e.id === selectedId)) {
      setSelectedId(endpoints[0]?.id || '');
    }
  }, [endpoints, selectedId]);

  const selected = endpoints.find((e) => e.id === selectedId) || endpoints[0];

  if (!endpoints.length) {
    return <p className="text-sm text-navy-500">No endpoints in this group.</p>;
  }

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-navy-100 lg:flex-row">
      <nav
        className="shrink-0 border-b border-navy-100 bg-navy-50/40 lg:w-[280px] lg:border-b-0 lg:border-r"
        aria-label="Endpoints"
      >
        <ul className="max-h-48 overflow-y-auto lg:max-h-none">
          {endpoints.map((endpoint) => {
            const active = endpoint.id === selected?.id;
            return (
              <li key={endpoint.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(endpoint.id)}
                  className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-white border-l-2 border-l-cyan-600 lg:border-l-2'
                      : 'border-l-2 border-l-transparent hover:bg-white/70'
                  }`}
                >
                  <MethodBadge method={endpoint.method} />
                  <span className="min-w-0">
                    <code className="block truncate font-mono text-xs text-navy-800">{endpoint.path}</code>
                    <span className="mt-0.5 block truncate text-[11px] text-navy-500">{endpoint.summary}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 bg-white p-4 sm:p-5">
        {selected && (
          <EndpointDetail endpoint={selected} baseUrl={baseUrl} onCopy={onCopy} />
        )}
      </div>
    </div>
  );
}

function OverviewPanel({
  baseUrl,
  exampleCurl,
  onCopy,
}) {
  const metaEndpoints = useMemo(
    () => EXTERNAL_API_ENDPOINT_DOCS.filter((e) => e.group === 'meta'),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-4">
          <p className="text-sm font-medium text-navy-900">Authentication</p>
          <p className="mt-1 text-sm text-navy-600">
            Send your API key with every request (except <code>/health</code>).
          </p>
          <div className="mt-3 space-y-1 text-xs text-navy-700">
            <p><code>Authorization: Bearer &lt;api-key&gt;</code></p>
            <p><code>X-Api-Key: &lt;api-key&gt;</code></p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="truncate rounded bg-white px-2 py-1 text-xs text-navy-900 border border-navy-100">{baseUrl}</code>
            <button
              type="button"
              onClick={() => onCopy?.(baseUrl, 'Base URL copied')}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-600"
            >
              <Copy size={12} />
              Copy
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-4">
          <p className="text-sm font-medium text-navy-900">Quick start</p>
          <p className="mt-1 text-sm text-navy-600">Copy a sample request to test the API.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-cyan-100">
            {exampleCurl}
          </pre>
          <button
            type="button"
            onClick={() => onCopy?.(exampleCurl, 'cURL copied')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-600"
          >
            <Copy size={12} />
            Copy cURL
          </button>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-navy-900">Utility endpoints</p>
        <ResourceEndpointPanel endpoints={metaEndpoints} baseUrl={baseUrl} onCopy={onCopy} />
      </div>
    </div>
  );
}

function DocTabs({ activeTab, onChange }) {
  return (
    <div className="border-b border-navy-100">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="API documentation sections">
        {EXTERNAL_API_DOC_GROUPS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-cyan-600 text-cyan-700'
                  : 'border-transparent text-navy-500 hover:border-navy-200 hover:text-navy-800'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function ExternalApiDocumentation({
  baseUrl,
  exampleCurl,
  onCopy,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = EXTERNAL_API_DOC_GROUPS.some((tab) => tab.id === searchParams.get('doc'))
    ? searchParams.get('doc')
    : 'overview';

  const setActiveTab = useCallback((tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === 'overview') next.delete('doc');
      else next.set('doc', tabId);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const groupEndpoints = useMemo(
    () => EXTERNAL_API_ENDPOINT_DOCS.filter((e) => e.group === activeTab),
    [activeTab],
  );

  return (
    <div className="space-y-4">
      <DocTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <OverviewPanel
          baseUrl={baseUrl}
          exampleCurl={exampleCurl}
          onCopy={onCopy}
        />
      ) : (
        <ResourceEndpointPanel
          endpoints={groupEndpoints}
          baseUrl={baseUrl}
          onCopy={onCopy}
        />
      )}
    </div>
  );
}
