import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of readdirSync(new URL('../js/', import.meta.url)).filter(file => file.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', 'js/' + file], { cwd: root, stdio: 'inherit' });
  } catch {
    console.error('Fix the JavaScript syntax above, then run npm run check again.');
    process.exit(1);
  }
}
execFileSync('python3', ['scripts/sync-motion-icons.py', '--check'], { cwd: root, stdio: 'inherit' });
console.log('JavaScript syntax and native SVG copies checked.');
