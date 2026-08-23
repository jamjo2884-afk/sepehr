/**
 * Convert "گزارش ماهیانه سپهر.xlsx" (long format) to standard import format.
 *
 * Source format (no headers, 8 columns):
 *   brand | platform_persian | username | metric_type | value | date_persian | period | period_label
 *
 * Target format (with headers):
 *   platform | account_identifier | period | period_label | followers | reach | views
 */
const XLSX = require('xlsx');
const path = require('path');

const INPUT = String.raw`C:\Users\milad\Desktop\پروژه 1\گزارش ها\گزارش ماهیانه سپهر.xlsx`;
const OUTPUT = String.raw`C:\Users\milad\Desktop\پروژه 1\گزارش ها\گزارش-ماهانه-سپهر-استاندارد.xlsx`;

// ── Metric name mapping ────────────────────────────────────────────────────
const METRIC_MAP = {
  'Follower': 'followers',
  'Reach': 'reach',
  'View': 'views',
};

// ── Platform mapping (Persian → Latin key) ─────────────────────────────────
const PLATFORM_MAP = {
  'تلگرام': 'telegram',
  'اینستاگرام': 'instagram',
  'ایکس': 'twitter',
  'سروش پلاس': 'soroushplus',
  'روبیکا': 'rubika',
  'بله': 'bale',
  'ایتا': 'eita',
  'یوتیوب': 'youtube',
  'آپارات': 'aparat',
  'سایت': 'site',
  'کلاب هاوس': 'threads',
  'ویراستی': 'virasty',
  'گپ': 'gap',
  'روبینو': 'rubika',     // Rubino → map to rubika or keep separate
  'آی گپ': 'igap',
};

// ── Read source ────────────────────────────────────────────────────────────
const wb = XLSX.readFile(INPUT);
const ws = wb.Sheets[wb.SheetNames[0]]; // "Data" sheet
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log(`Source rows: ${rawData.length}`);

// ── Group by (platform, username, period) ──────────────────────────────────
// Key: "platform|username|period_label"
// Value: { brand, platform, username, periodLabel, metrics: { followers, reach, views } }
const grouped = new Map();

let skipped = 0;
for (const row of rawData) {
  const brand = String(row[0] ?? '').trim();
  const platformFa = String(row[1] ?? '').trim();
  const username = String(row[2] ?? '').trim();
  const metricType = String(row[3] ?? '').trim();
  const value = row[4];
  const periodLabel = String(row[6] ?? row[7] ?? '').trim(); // prefer YYYY-MM

  // Skip empty rows or rows with no platform/metric
  if (!platformFa || !username || !metricType) {
    skipped++;
    continue;
  }

  const platform = PLATFORM_MAP[platformFa];
  if (!platform) {
    console.warn(`  Unknown platform: "${platformFa}" — skipping row`);
    skipped++;
    continue;
  }

  const metricKey = METRIC_MAP[metricType];
  if (!metricKey) {
    console.warn(`  Unknown metric: "${metricType}" — skipping row`);
    skipped++;
    continue;
  }

  // Parse the period label
  const pl = periodLabel.replace(/\s+/g, '-');
  const key = `${platform}|${username}|${pl}`;

  if (!grouped.has(key)) {
    grouped.set(key, {
      brand,
      platform,
      username,
      period: 'monthly',
      periodLabel: pl,
      metrics: {},
    });
  }

  const entry = grouped.get(key);
  // Take the latest value if duplicated
  const numVal = typeof value === 'number' ? value : Number(String(value).replace(/[،,]/g, ''));
  if (Number.isFinite(numVal) && numVal > 0) {
    entry.metrics[metricKey] = numVal;
  }
}

console.log(`Grouped into ${grouped.size} unique rows (skipped ${skipped} rows)`);

// ── Build output matrix ────────────────────────────────────────────────────
const headers = [
  'platform',
  'account_identifier',
  'period',
  'period_label',
  'Followers',
  'Reach',
  'Views',
];

const outputRows = [];
for (const entry of grouped.values()) {
  outputRows.push([
    entry.platform,
    entry.username,
    entry.period,
    entry.periodLabel,
    entry.metrics.followers ?? '',
    entry.metrics.reach ?? '',
    entry.metrics.views ?? '',
  ]);
}

// Sort by platform, then username, then period
outputRows.sort((a, b) => {
  const cmp = a[0].localeCompare(b[0]);
  if (cmp !== 0) return cmp;
  const cmp2 = a[1].localeCompare(b[1]);
  if (cmp2 !== 0) return cmp2;
  return a[3].localeCompare(b[3]);
});

console.log(`Output rows: ${outputRows.length}`);

// ── Write output ───────────────────────────────────────────────────────────
const wsOutput = XLSX.utils.aoa_to_sheet([headers, ...outputRows]);

// Set column widths
wsOutput['!cols'] = [
  { wch: 15 },  // platform
  { wch: 25 },  // account_identifier
  { wch: 10 },  // period
  { wch: 12 },  // period_label
  { wch: 12 },  // Followers
  { wch: 12 },  // Reach
  { wch: 12 },  // Views
];

const wbOutput = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOutput, wsOutput, 'Data');
XLSX.writeFile(wbOutput, OUTPUT);

console.log(`\n✅ Saved to: ${OUTPUT}`);

// ── Verify ─────────────────────────────────────────────────────────────────
const wbVerify = XLSX.readFile(OUTPUT);
const wsVerify = wbVerify.Sheets[wbVerify.SheetNames[0]];
const verifyData = XLSX.utils.sheet_to_json(wsVerify, { header: 1, defval: '' });
console.log(`\nVerification:`);
console.log(`  Sheet: ${wbVerify.SheetNames[0]}`);
console.log(`  Total rows (inc. header): ${verifyData.length}`);
console.log(`  Header: ${JSON.stringify(verifyData[0])}`);
console.log(`  Row 1:  ${JSON.stringify(verifyData[1])}`);
console.log(`  Row 2:  ${JSON.stringify(verifyData[2])}`);

// Platform stats
const platforms = {};
for (let i = 1; i < verifyData.length; i++) {
  const p = verifyData[i][0];
  platforms[p] = (platforms[p] || 0) + 1;
}
console.log(`\n  Rows per platform:`);
Object.entries(platforms).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
  console.log(`    ${p}: ${c}`);
});
