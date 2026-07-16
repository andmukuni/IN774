import {
  Building2,
  ChevronRight,
  Globe2,
  Laptop,
  Monitor,
  Network,
  Smartphone,
  User,
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

const CATEGORY_ICONS = {
  Monitor,
  Desktop: Monitor,
  Laptop,
  Tablet: Laptop,
  Phone: Smartphone,
};

function DeviceIcon({ category, className, size = 20 }) {
  const key = String(category || '').trim();
  const Icon = CATEGORY_ICONS[key] || Laptop;
  return <Icon className={className} size={size} />;
}

function DiagramNode({
  icon: Icon,
  title,
  subtitle,
  highlight = false,
  iconProps = {},
}) {
  return (
    <div
      className={`flex w-[132px] shrink-0 flex-col items-center rounded-2xl border px-3 py-3 text-center ${
        highlight
          ? 'border-cyan-300 bg-cyan-50 shadow-sm'
          : 'border-navy-100 bg-white'
      }`}
    >
      <div
        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${
          highlight ? 'bg-cyan-100 text-cyan-700' : 'bg-navy-50 text-navy-600'
        }`}
      >
        <Icon size={18} {...iconProps} />
      </div>
      <p className={`line-clamp-2 text-xs font-semibold leading-tight ${highlight ? 'text-cyan-900' : 'text-navy-900'}`}>
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-navy-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Connector({ label }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1">
      <div className="flex items-center text-navy-300">
        <div className="h-px w-5 bg-gradient-to-r from-navy-200 to-cyan-300" />
        <ChevronRight size={14} className="text-cyan-500" />
        <div className="h-px w-5 bg-gradient-to-r from-cyan-300 to-navy-200" />
      </div>
      {label && (
        <span className="mt-1 max-w-[72px] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-navy-400">
          {label}
        </span>
      )}
    </div>
  );
}

export default function ItemArchitectureDiagram({ architecture }) {
  if (!architecture) {
    return (
      <p className="text-sm text-navy-500">No placement data available for this item.</p>
    );
  }

  const { network, branch, employee, device, placement } = architecture;
  const isBranchAsset = placement === 'branch';

  const nodes = [
    {
      key: 'network',
      icon: Globe2,
      title: network?.label || 'Corporate network',
      subtitle: 'WAN / MPLS',
    },
    {
      key: 'lan',
      icon: Network,
      title: 'Branch LAN',
      subtitle: 'Switches & Wi‑Fi',
      connector: 'LAN',
    },
    {
      key: 'branch',
      icon: Building2,
      title: branch?.name || 'Unassigned branch',
      subtitle: branch?.code || 'No branch',
      connector: 'LAN',
    },
  ];

  if (!isBranchAsset && employee) {
    nodes.push({
      key: 'employee',
      icon: User,
      title: employee.name || 'Employee',
      subtitle: employee.code || 'Assigned user',
      connector: 'Workstation',
    });
  }

  nodes.push({
    key: 'device',
    icon: DeviceIcon,
    iconProps: { category: device?.category },
    title: device?.name || 'This item',
    subtitle: [
      device?.category,
      device?.sku ? `S/N ${device.sku}` : null,
    ].filter(Boolean).join(' · '),
    connector: isBranchAsset ? 'Shared' : 'Device',
    highlight: true,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
          Network placement diagram
        </p>

        <div className="overflow-x-auto pb-1">
          <div className="mx-auto flex w-max min-w-full items-center justify-center gap-0 px-1">
            {nodes.map((node, index) => (
              <div key={node.key} className="flex items-center">
                {index > 0 && <Connector label={node.connector} />}
                <DiagramNode
                  icon={node.icon}
                  iconProps={node.iconProps}
                  title={node.title}
                  subtitle={node.subtitle}
                  highlight={node.highlight}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">Placement</p>
          <p className="mt-1 text-sm font-medium text-navy-900">
            {isBranchAsset ? 'Branch-shared asset' : 'Employee-assigned device'}
          </p>
        </div>
        <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">Status</p>
          <div className="mt-1">
            <StatusBadge status={device?.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
