// Copies Cesium's prebuilt static assets into /public/cesium so the globe can
// load its Workers/Assets at runtime. Runs on postinstall and before build.
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const src = join(process.cwd(), 'node_modules', 'cesium', 'Build', 'Cesium');
const dest = join(process.cwd(), 'public', 'cesium');

if (!existsSync(src)) {
  console.warn('[copy-cesium] cesium build not found at', src, '- skipping');
  process.exit(0);
}
for (const dir of ['Workers', 'Assets', 'Widgets', 'ThirdParty']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('[copy-cesium] copied Cesium static assets to public/cesium');