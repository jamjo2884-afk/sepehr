#!/usr/bin/env node
/**
 * Seed the Supabase `social_followers` table from the bundled snapshot
 * (src/features/mock-data/social-data.generated.ts).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-social-data.mjs
 *
 * The service role key is required: the table's RLS policy only allows reads
 * for the anon/authenticated keys, so a service-role (or direct SQL) write
 * path is the only one that works.
 *
 * The script is idempotent: it upserts on (brand, platform, handle, month),
 * so re-running refreshes changed values without duplicating rows.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 1. Load the generated snapshot (strip TS syntax, evaluate in a VM).
// ---------------------------------------------------------------------------
const src = readFileSync(
  join(root, 'src', 'features', 'mock-data', 'social-data.generated.ts'),
  'utf8',
);
const js = src
  .replace(/\/\/[^\n]*/g, '')
  .replace(/export interface\s+\w+\s*\{[^}]*\}/g, '')
  .replace('export const socialBrandData: SocialBrandNode[]', 'const socialBrandData');
const data = vm.runInNewContext(`${js}\n; socialBrandData;`, {});

// ---------------------------------------------------------------------------
// 2. Flatten brand tree -> rows.
// ---------------------------------------------------------------------------
const PLATFORMS = new Set([
  'instagram', 'telegram', 'youtube', 'twitter',
  'bale', 'eita', 'rubika', 'soroushplus',
]);
const rows = [];
for (const brand of data) {
  for (const [platform, handles] of Object.entries(brand.platforms)) {
    if (!PLATFORMS.has(platform) || !handles) continue;
    for (const series of Object.values(handles)) {
      for (const point of series.series) {
        rows.push({
          brand: brand.name,
          platform,
          handle: series.handle,
          month: point.month,
          followers: point.value,
        });
      }
    }
  }
}
if (rows.length === 0) {
  console.error('No rows extracted from the snapshot — aborting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Upsert in batches.
// ---------------------------------------------------------------------------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    'Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const BATCH = 500;
let upserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase
    .from('social_followers')
    .upsert(batch, { onConflict: 'brand,platform,handle,month' });
  if (error) {
    console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    process.exit(1);
  }
  upserted += batch.length;
  console.log(`  upserted ${upserted}/${rows.length} rows`);
}

const unique = new Set(rows.map((r) => `${r.brand}|${r.platform}|${r.handle ?? ''}|${r.month}`));
console.log(
  `Done. ${rows.length} rows upserted (${unique.size} unique brand × platform × handle × month) ` +
    `across ${new Set(rows.map((r) => r.brand)).size} brands.`,
);
