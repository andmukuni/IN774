import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  EXTERNAL_API_ENDPOINT_DOCS,
  EXTERNAL_API_ERRORS,
  EXTERNAL_API_PAGINATION,
} from '../../../shared/externalApiDocs.js';

function MethodBadge({ method }) {
  return (
    <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      {method}
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

function EndpointDocItem({ endpoint, baseUrl }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-navy-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-navy-50/60"
      >
        <span className="mt-0.5 text-navy-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <code className="font-mono text-xs text-navy-800">{endpoint.path}</code>
            <ScopeBadge scope={endpoint.scope} />
          </div>
          <p className="mt-1 text-sm text-navy-600">{endpoint.summary}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-navy-100 bg-navy-50/30 px-4 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Request</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs text-cyan-100">
              {`${endpoint.method} ${baseUrl}${endpoint.path.replace(':id', '{id}')}`}
            </pre>
          </div>

          {endpoint.queryParams?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">Query parameters</p>
              <div className="overflow-x-auto rounded-lg border border-navy-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-white text-navy-500">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 mb-2">Example response</p>
            <pre className="overflow-x-auto rounded-lg bg-navy-900 p-3 text-xs leading-relaxed text-cyan-100">
              {JSON.stringify(endpoint.responseExample, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExternalApiDocumentation({ baseUrl }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-navy-900 mb-2">Endpoint overview</p>
        <div className="overflow-x-auto rounded-xl border border-navy-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-navy-50 text-navy-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 font-medium">Path</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 bg-white">
              {EXTERNAL_API_ENDPOINT_DOCS.map((endpoint) => (
                <tr key={endpoint.id}>
                  <td className="px-4 py-2.5">
                    <MethodBadge method={endpoint.method} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-navy-800">{endpoint.path}</td>
                  <td className="px-4 py-2.5">
                    <ScopeBadge scope={endpoint.scope} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-4">
          <p className="text-sm font-medium text-navy-900">{EXTERNAL_API_PAGINATION.title}</p>
          <p className="mt-1 text-sm text-navy-600">{EXTERNAL_API_PAGINATION.description}</p>
          <ul className="mt-3 space-y-1 text-xs text-navy-600">
            {EXTERNAL_API_PAGINATION.params.map((param) => (
              <li key={param.name}>
                <code className="text-navy-800">{param.name}</code>
                {' '}
                <span className="text-navy-400">({param.type})</span>
                {' — '}
                {param.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-navy-100 bg-navy-50/40 p-4">
          <p className="text-sm font-medium text-navy-900">Error responses</p>
          <p className="mt-1 text-sm text-navy-600">All errors return JSON: <code>{'{ ok: false, message: "…" }'}</code></p>
          <ul className="mt-3 space-y-1.5 text-xs text-navy-600">
            {EXTERNAL_API_ERRORS.map((error) => (
              <li key={error.status}>
                <span className="font-semibold text-navy-800">{error.status}</span>
                {' — '}
                {error.meaning}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-navy-900 mb-3">Detailed endpoint reference</p>
        <div className="space-y-2">
          {EXTERNAL_API_ENDPOINT_DOCS.map((endpoint) => (
            <EndpointDocItem key={endpoint.id} endpoint={endpoint} baseUrl={baseUrl} />
          ))}
        </div>
      </div>
    </div>
  );
}
