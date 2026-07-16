import { PageHeader, Card } from '../../components/ui';
import { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLES } from '../../../shared/rbacPermissions.js';

export default function DemoAccessControlPage() {
  return (
    <div>
      <PageHeader
        title="Access Control"
        subtitle="RBAC catalog — extend with role management UI"
        breadcrumbs={[
          { label: 'Admin', to: '/admin' },
          { label: 'Access Control' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Permissions" subtitle={`${ADMIN_PERMISSIONS.length} template permissions`}>
          <ul className="divide-y divide-navy-100">
            {ADMIN_PERMISSIONS.map((perm) => (
              <li key={perm.key} className="py-2.5 flex justify-between gap-4 text-sm">
                <span className="font-medium text-navy-800">{perm.name}</span>
                <code className="text-xs text-navy-500 bg-navy-50 px-2 py-0.5 rounded">{perm.key}</code>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Default roles" subtitle="Seeded on first boot">
          <ul className="space-y-3">
            {DEFAULT_ADMIN_ROLES.map((role) => (
              <li key={role.slug} className="rounded-xl border border-navy-100 p-4">
                <p className="font-medium text-navy-900">{role.name}</p>
                <p className="text-xs text-navy-500 mt-1">{role.description}</p>
                <p className="text-xs text-cyan-700 mt-2">{role.permissions.length} permissions</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
