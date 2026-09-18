/**
 * One-shot codemod: replace dynamic imports of the shared anon-key client
 * (`await import('@/lib/supabase')`) with the RLS-aware `getSupabase()` from
 * '@/lib/db' in server services/routes. Idempotent.
 *
 * Usage: node scripts/switch-to-rls-client.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'src/services/social.service.ts',
  'src/services/social-sync.service.ts',
  'src/services/social-bulk-edit.service.ts',
  'src/services/social-data-quality.service.ts',
  'src/services/social-data-quality-review.service.ts',
  'src/services/social-import/import.service.ts',
  'src/services/import-review/import-review.service.ts',
  'src/services/import-review/anomaly-detection.ts',
  'src/services/data.service.ts',
  'src/services/finance/finance-analytics.service.ts',
  'src/app/api/social/import/review/sessions/[id]/anomalies/route.ts',
];

const RE_LOCAL = /const \{ supabase \} = await import\('@\/lib\/supabase'\);/g;
const RE_INLINE = /\(await import\('@\/lib\/supabase'\)\)\.supabase/g;

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(RE_LOCAL, 'const supabase = await getSupabase();');
  src = src.replace(RE_INLINE, '(await getSupabase())');

  if (src === before) {
    console.log(`SKIP (no match): ${file}`);
    continue;
  }

  if (!src.includes("from '@/lib/db'")) {
    // Insert the import after the last top-of-file import line.
    const lines = src.split('\n');
    let lastImport = -1;
    for (let i = 0; i < Math.min(lines.length, 80); i++) {
      if (/^import /.test(lines[i])) lastImport = i;
    }
    if (lastImport === -1) throw new Error(`No import block found in ${file}`);
    lines.splice(lastImport + 1, 0, "import { getSupabase } from '@/lib/db';");
    src = lines.join('\n');
  }

  writeFileSync(file, src);
  const count = (before.match(RE_LOCAL) || []).length + (before.match(RE_INLINE) || []).length;
  console.log(`OK: ${file} (${count} site${count === 1 ? '' : 's'})`);
}
console.log('Codemod complete.');
