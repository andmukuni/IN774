import {
  Building2,
  ChevronRight,
  ClipboardList,
  Database,
  Server,
  User,
  Users,
} from 'lucide-react';

const NODE_ICONS = {
  intake: ClipboardList,
  api: Server,
  db: Database,
  branches: Building2,
  employees: Users,
  products: User,
};

function DiagramNode({ node, highlight = false }) {
  const Icon = NODE_ICONS[node.id] || Server;
  return (
    <div
      className={`flex w-[128px] shrink-0 flex-col items-center rounded-2xl border px-3 py-3 text-center ${
        highlight ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-navy-100 bg-white'
      }`}
    >
      <div
        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${
          highlight ? 'bg-cyan-100 text-cyan-700' : 'bg-navy-50 text-navy-600'
        }`}
      >
        <Icon size={18} />
      </div>
      <p className={`line-clamp-2 text-xs font-semibold leading-tight ${highlight ? 'text-cyan-900' : 'text-navy-900'}`}>
        {node.label}
      </p>
      {node.subtitle && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-navy-500">{node.subtitle}</p>
      )}
    </div>
  );
}

function Connector({ label }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1">
      <div className="flex items-center text-navy-300">
        <div className="h-px w-4 bg-gradient-to-r from-navy-200 to-cyan-300" />
        <ChevronRight size={14} className="text-cyan-500" />
        <div className="h-px w-4 bg-gradient-to-r from-cyan-300 to-navy-200" />
      </div>
      {label && (
        <span className="mt-1 max-w-[68px] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-navy-400">
          {label}
        </span>
      )}
    </div>
  );
}

const FLOW = [
  { nodeId: 'intake', connector: 'HTTPS' },
  { nodeId: 'api', connector: 'SQL' },
  { nodeId: 'db', connector: 'Data' },
  { nodeId: 'branches', connector: 'Staff' },
  { nodeId: 'employees', connector: 'Assets' },
  { nodeId: 'products', connector: null },
];

export default function SystemArchitectureDiagram({ architecture }) {
  if (!architecture?.nodes?.length) {
    return <p className="text-sm text-navy-500">Architecture data unavailable.</p>;
  }

  const nodeMap = Object.fromEntries(architecture.nodes.map((node) => [node.id, node]));

  return (
    <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
        System architecture
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex w-max min-w-full items-center justify-center">
          {FLOW.map((step, index) => {
            const node = nodeMap[step.nodeId];
            if (!node) return null;
            return (
              <div key={step.nodeId} className="flex items-center">
                {index > 0 && <Connector label={FLOW[index - 1].connector} />}
                <DiagramNode node={node} highlight={step.nodeId === 'api'} />
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-navy-500">
        Public branch intake writes to the API, which stores inventory across branches, employees, and products.
      </p>
    </div>
  );
}
