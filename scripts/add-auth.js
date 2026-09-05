#!/usr/bin/env node
/**
 * Adds `requireAuth` to API route files.
 *
 * For each file:
 * 1. Adds `import { requireAuth } from '@/lib/route-auth';` after first import
 * 2. Wraps `export async function NAME(...)` with `requireAuth` inline check
 * 3. Adds `export const dynamic = 'force-dynamic';` if missing
 */

const fs = require('fs');
const path = require('path');

const FILES = [
  'src/app/api/social/import/review/sessions/route.ts',
  'src/app/api/social/import/review/sessions/[id]/route.ts',
  'src/app/api/social/import/review/sessions/[id]/anomalies/route.ts',
  'src/app/api/social/import/review/sessions/[id]/commit/route.ts',
  'src/app/api/social/import/review/sessions/[id]/preview/route.ts',
  'src/app/api/social/import/review/sessions/[id]/rows/route.ts',
  'src/app/api/social/import/review/sessions/[id]/rows/[rowId]/route.ts',
  'src/app/api/social/import/review/sessions/[id]/rows/[rowId]/candidates/route.ts',
  'src/app/api/social/import/review/sessions/[id]/rows/[rowId]/reject/route.ts',
  'src/app/api/social/import/review/sessions/[id]/rows/[rowId]/resolve/route.ts',
  'src/app/api/social/import/review/sessions/[id]/validate/route.ts',
  'src/app/api/social/import/review/upload/route.ts',
];

for (const relPath of FILES) {
  const filePath = path.join(process.cwd(), relPath);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already has requireAuth
  if (content.includes('requireAuth')) {
    console.log(`SKIP (already has auth): ${relPath}`);
    continue;
  }

  // 1. Add import after first import line
  const firstImportIdx = content.indexOf("import ");
  const firstImportEnd = content.indexOf('\n', firstImportIdx);
  content = content.slice(0, firstImportEnd + 1) +
    "import { requireAuth } from '@/lib/route-auth';\n" +
    content.slice(firstImportEnd + 1);

  // 2. Add dynamic = 'force-dynamic' if missing
  if (!content.includes("export const dynamic")) {
    // Add after imports, before first export
    const firstExportIdx = content.indexOf('\nexport ');
    content = content.slice(0, firstExportIdx) +
      '\nexport const dynamic = \'force-dynamic\';\n' +
      content.slice(firstExportIdx);
  }

  // 3. For each `export async function NAME(...)`, add auth check after opening brace
  // Pattern: find "export async function" and add auth after the line with "{"
  const funcRegex = /export async function (\w+)\(([^)]*)\):\s*Promise<NextResponse>\s*\{/g;
  let match;
  const insertions = [];
  while ((match = funcRegex.exec(content)) !== null) {
    const braceIdx = match.index + match[0].length;
    const authCode = "\n  const auth = await requireAuth();\n  if ('error' in auth) return auth.error;\n";
    insertions.push({ idx: braceIdx, code: authCode });
  }

  // Apply insertions in reverse order to preserve indices
  for (let i = insertions.length - 1; i >= 0; i--) {
    const { idx, code } = insertions[i];
    content = content.slice(0, idx) + code + content.slice(idx);
  }

  fs.writeFileSync(filePath, content);
  console.log(`DONE: ${relPath} (${insertions.length} functions wrapped)`);
}
