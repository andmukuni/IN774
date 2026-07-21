import { ensureDatabase } from '../server/db.js';
import { ensureMonitorTables, seedMonitorTargets } from '../server/utils/monitorHelpers.js';

async function main() {
  await ensureDatabase();
  await ensureMonitorTables();
  await seedMonitorTargets();
  console.log('[monitor] Seed complete.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[monitor] Seed failed:', error.message);
  process.exit(1);
});
