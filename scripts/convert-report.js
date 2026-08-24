/**
 * Convert raw "گزارش ماهیانه سپهر.xlsx" (long format) to:
 *
 * 1. Wide-format import file (for the standard import pipeline)
 * 2. Mock data TypeScript file (social-data.generated.ts)
 *
 * Source format (long, 10 columns):
 *   برند | سکو | وضعیت | شناسه | لینک | شاخص | مقدار | تاریخ | ماه | month
 *
 * Usage:
 *   node scripts/convert-report.js [input.xlsx] [output-dir]
 */
var XLSX = require('xlsx');
var path = require('path');
var fs = require('fs');

// Paths
var INPUT = process.argv[2] || 'C:\\Users\\milad\\Downloads\\گزارش ماهیانه سپهر.xlsx';
var OUTPUT_DIR = process.argv[3] || 'C:\\Users\\milad\\Desktop\\';
var MOCK_DATA_PATH = path.resolve(__dirname, '../src/features/mock-data/social-data.generated.ts');

// Metric name mapping
var METRIC_MAP = {
  'Follower': 'followers',
  'Reach': 'reach',
  'View': 'views',
  'Like': 'likes',
  'Comment': 'comments',
  'Share': 'shares',
  'Post': 'posts',
  'Subscriber': 'subscribers'
};

// Platform mapping (Persian to Latin key)
var PLATFORM_MAP = {
  '\u062A\u0644\u06AF\u0631\u0627\u0645': 'telegram',
  '\u0627\u06CC\u0646\u0633\u062A\u0627\u06AF\u0631\u0627\u0645': 'instagram',
  '\u0627\u06CC\u06A9\u0633': 'twitter',
  '\u0641\u06CC\u0633\u0628\u0648\u06A9': 'facebook',
  '\u0633\u0631\u0648\u0634 \u067E\u0644\u0627\u0633': 'soroushplus',
  '\u0631\u0648\u0628\u06CC\u06A9\u0627': 'rubika',
  '\u0628\u0644\u0647': 'bale',
  '\u0627\u06CC\u062A\u0627': 'eita',
  '\u06CC\u0648\u062A\u06CC\u0648\u0628': 'youtube',
  '\u0622\u067E\u0627\u0631\u0627\u062A': 'aparat',
  '\u0633\u0627\u06CC\u062A': 'site',
  '\u06A9\u0644\u0627\u0628 \u0647\u0627\u0648\u0633': 'clubhouse',
  '\u0648\u06CC\u0631\u0627\u0633\u062A\u06CC': 'virasty',
  '\u06AF\u067E': 'gap',
  '\u0631\u0648\u0628\u06CC\u0646\u0648': 'rubino',
  '\u0622\u06CC \u06AF\u067E': 'igap',
  '\u0634\u0627\u062F': 'shad'
};

// Status mapping
var STATUS_MAP = {
  '\u0641\u0639\u0627\u0644': 'active',
  '\u063A\u06CC\u0631 \u0641\u0639\u0627\u0644': 'inactive',
  '\u0631\u0627\u06A9\u062F': 'inactive'
};

// Brands to ignore (zero data, deleted from DB)
var IGNORED_BRANDS = [
  '\u0622\u0648\u0627\u0646\u062F',
  '\u0627\u0641\u0634\u0627\u06AF\u0631\u06CC',
  '\u0627\u0642\u062A\u0635\u0627\u062F\u0627\u0646 \u0634\u0648\u06CC\u062F',
  '\u0628\u0631\u062C\u0627\u0645',
  '\u067E\u0627\u062F\u062A\u0646',
  '\u067E\u0627\u0631\u0627\u06AF\u0631\u0627\u0641',
  '\u062A\u0627\u0631\u06A9\u062F',
  '\u062C\u0647\u0627\u0646 \u0646\u0645\u0627',
  '\u0634\u0647\u0631\u0648\u0646\u062F \u0646\u06AF\u0627\u0631',
  '\u0641\u0631\u062C\u0647',
  '\u0641\u0631\u0647\u0646\u06AF',
  '\u0645\u0627\u06CC\u0647 \u0634\u0631\u0645\u0633\u0627\u0631\u06CC',
  '\u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647\u0634\u062F'
];

// Read source
console.log('Reading: ' + INPUT);
var wb = XLSX.readFile(INPUT);
var ws = wb.Sheets[wb.SheetNames[0]];
var rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('Source rows: ' + rawData.length);

// Column mapping (matches actual Excel headers)
// Headers: برند | سکو | وضعیت | شناسه | لینک | شاخص | مقدار | تاریخ | ماه | month
var COL = {
  brand: 0,
  platform: 1,
  status: 2,
  username: 3,
  link: 4,
  metricType: 5,
  value: 6,
  date: 7,
  month: 8,
  monthEn: 9
};

// Group by (platform, username, period_label)
var grouped = new Map();
var skipped = 0;

for (var i = 1; i < rawData.length; i++) {
  var row = rawData[i];
  var brand = String(row[COL.brand] || '').trim();
  if (IGNORED_BRANDS.indexOf(brand) !== -1) {
    skipped++;
    continue;
  }
  var platformFa = String(row[COL.platform] || '').trim();
  var username = String(row[COL.username] || '').trim();
  var metricType = String(row[COL.metricType] || '').trim();
  var value = row[COL.value];
  var status = String(row[COL.status] || '').trim();
  var link = String(row[COL.link] || '').trim();
  var periodLabel = String(row[COL.monthEn] || row[COL.month] || '').trim();

  if (!platformFa || !username || !periodLabel) {
    skipped++;
    continue;
  }

  var platform = PLATFORM_MAP[platformFa];
  if (!platform) {
    console.warn('  Unknown platform: "' + platformFa + '" - skipping row');
    skipped++;
    continue;
  }

  var metricKey = METRIC_MAP[metricType];
  if (!metricKey) {
    console.warn('  Unknown metric: "' + metricType + '" - skipping row');
    skipped++;
    continue;
  }

  var rawVal = String(value || '').trim();
  if (!rawVal || rawVal === '-' || rawVal === '\u2014') {
    skipped++;
    continue;
  }

  var pl = periodLabel.replace(/\s+/g, '-');
  var key = platform + '|' + username + '|' + pl;

  if (!grouped.has(key)) {
    grouped.set(key, {
      brand: brand,
      platform: platform,
      username: username,
      status: STATUS_MAP[status] || 'active',
      link: link || null,
      period: 'monthly',
      periodLabel: pl,
      metrics: {}
    });
  }

  var entry = grouped.get(key);
  var numVal = typeof value === 'number' ? value : Number(rawVal.replace(/[،,]/g, '').replace(/[\s\u00A0]/g, ''));
  if (Number.isFinite(numVal) && numVal > 0) {
    entry.metrics[metricKey] = numVal;
  }
}

console.log('Grouped into ' + grouped.size + ' unique rows (skipped ' + skipped + ' rows)');

// 1. Generate wide-format import file
var headers = ['platform', 'account_identifier', 'period', 'period_label', 'Followers', 'Reach', 'Views'];
var outputRows = [];

for (var entry of grouped.values()) {
  outputRows.push([
    entry.platform,
    entry.username,
    entry.period,
    entry.periodLabel,
    entry.metrics.followers || '',
    entry.metrics.reach || '',
    entry.metrics.views || ''
  ]);
}

outputRows.sort(function(a, b) {
  var cmp = a[0].localeCompare(b[0]);
  if (cmp !== 0) return cmp;
  var cmp2 = a[1].localeCompare(b[1]);
  if (cmp2 !== 0) return cmp2;
  return a[3].localeCompare(b[3]);
});

console.log('Wide-format output rows: ' + outputRows.length);

var wsOutput = XLSX.utils.aoa_to_sheet([headers].concat(outputRows));
wsOutput['!cols'] = [
  { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
  { wch: 12 }, { wch: 12 }, { wch: 12 }
];

var wbOutput = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOutput, wsOutput, 'Data');
var importPath = path.join(OUTPUT_DIR, 'import-sepehr.xlsx');
XLSX.writeFile(wbOutput, importPath);
console.log('Import file saved: ' + importPath);

// 2. Generate mock data TypeScript file
var brandMap = new Map();

for (var entry of grouped.values()) {
  var brandName = entry.brand;
  var plat = entry.platform;
  var uname = entry.username;
  var plabel = entry.periodLabel;
  var metrics = entry.metrics;

  if (!brandMap.has(brandName)) brandMap.set(brandName, new Map());
  var platforms = brandMap.get(brandName);
  if (!platforms.has(plat)) platforms.set(plat, new Map());
  var accounts = platforms.get(plat);
  if (!accounts.has(uname)) accounts.set(uname, []);

  var followers = metrics.followers || 0;
  if (followers > 0) {
    accounts.get(uname).push({ month: plabel, value: followers });
  }
}

// Build TypeScript output
var lines = [];
lines.push('// AUTO-GENERATED from raw Excel. Do not edit by hand.');
lines.push('export interface SocialMonthlyPoint { month: string; value: number; }');
lines.push('export interface SocialAccountSeries { handle: string | null; series: SocialMonthlyPoint[]; }');
lines.push('export interface SocialBrandPlatform { [handleKey: string]: SocialAccountSeries; }');
lines.push('export interface SocialBrandNode {');
lines.push('  name: string;');
lines.push('  platforms: Partial<Record<string, SocialBrandPlatform>>;');
lines.push('}');
lines.push('export const socialBrandData: SocialBrandNode[] = [');

var brandIdx = 0;
for (var brandEntry of brandMap) {
  var bName = brandEntry[0];
  var bPlatforms = brandEntry[1];
  var prefix = brandIdx > 0 ? ',' : '';
  lines.push(prefix + '  {');
  lines.push('    "name": ' + JSON.stringify(bName) + ',');
  lines.push('    "platforms": {');

  var platIdx = 0;
  for (var platEntry of bPlatforms) {
    var pName = platEntry[0];
    var pAccounts = platEntry[1];
    var platPrefix = platIdx > 0 ? ',' : '';
    lines.push('      ' + platPrefix + JSON.stringify(pName) + ': {');

    var accIdx = 0;
    for (var accEntry of pAccounts) {
      var aName = accEntry[0];
      var aSeries = accEntry[1];
      var sorted = aSeries.slice().sort(function(x, y) {
        return x.month < y.month ? -1 : x.month > y.month ? 1 : 0;
      });
      var accPrefix = accIdx > 0 ? ',' : '';
      lines.push('        ' + accPrefix + JSON.stringify(aName) + ': {');
      lines.push('          "handle": ' + JSON.stringify(aName) + ',');
      lines.push('          "series": [');
      for (var si = 0; si < sorted.length; si++) {
        var sp = sorted[si];
        var spPrefix = si > 0 ? ',' : '';
        lines.push('            ' + spPrefix + '{ "month": ' + JSON.stringify(sp.month) + ', "value": ' + sp.value + ' }');
      }
      lines.push('          ]');
      lines.push('        }');
      accIdx++;
    }

    lines.push('      }');
    platIdx++;
  }

  lines.push('    }');
  lines.push('  }');
  brandIdx++;
}

lines.push('];');
lines.push('');

var tsContent = lines.join('\n');
fs.writeFileSync(MOCK_DATA_PATH, tsContent, 'utf8');
console.log('Mock data saved: ' + MOCK_DATA_PATH);

// Stats
var platformCounts = {};
for (var ri = 0; ri < outputRows.length; ri++) {
  var p = outputRows[ri][0];
  platformCounts[p] = (platformCounts[p] || 0) + 1;
}
console.log('\nRows per platform:');
Object.keys(platformCounts).sort(function(a, b) { return platformCounts[b] - platformCounts[a]; }).forEach(function(p) {
  console.log('  ' + p + ': ' + platformCounts[p]);
});

var totalAccounts = 0;
for (var bv of brandMap.values()) {
  for (var pv of bv.values()) {
    totalAccounts += pv.size;
  }
}
console.log('\nBrands: ' + brandMap.size);
console.log('Total accounts: ' + totalAccounts);
