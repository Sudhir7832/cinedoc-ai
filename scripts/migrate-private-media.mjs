import fs from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'public', 'generated');
const destination = path.join(process.cwd(), process.env.DATA_DIR || 'data', 'generated');

if (!fs.existsSync(source)) {
  console.log('No public generated media directory exists.');
  process.exit(0);
}

fs.mkdirSync(destination, { recursive: true });
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^[A-Za-z0-9_-]{1,100}$/.test(entry.name)) continue;
  const from = path.join(source, entry.name);
  const to = path.join(destination, entry.name);
  fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false });
  fs.rmSync(from, { recursive: true, force: true });
}

if (fs.readdirSync(source).length === 0) fs.rmSync(source, { recursive: true, force: true });
console.log(`Generated media moved to ${destination}.`);
