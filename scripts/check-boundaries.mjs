import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'apps', 'web', 'src');
const forbidden = [
  /(?:\.\.\/)+移动端/u,
  /(?:\.\.\/)+platform(?:\/|')/u,
  /localStorage\.(?:setItem|getItem)\(/u,
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const files = (await filesIn(sourceRoot)).filter((file) => /\.(?:ts|tsx)$/u.test(file));
const violations = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.test(content)) violations.push(`${path.relative(root, file)}: ${rule}`);
  }
  if (file.includes(`${path.sep}features${path.sep}`) && /from ['"][^'"]*\/mocks\//u.test(content)) {
    violations.push(`${path.relative(root, file)}: feature must use the business gateway, not import mock data directly`);
  }
}

if (violations.length > 0) {
  console.error('Boundary check failed:\n' + violations.join('\n'));
  process.exit(1);
}

console.log(`Boundary check passed (${files.length} source files).`);
