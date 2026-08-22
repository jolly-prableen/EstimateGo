const fs = require('fs');
const path = require('path');

const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'entry.map.json'), 'utf8'));
const out = path.join(__dirname, 'source');

if (fs.existsSync(out)) {
  fs.rmSync(out, { recursive: true, force: true });
}
fs.mkdirSync(out, { recursive: true });

const written = [];

function cleanPathPart(part) {
  return part.replace(/[<>:"|?*]/g, '_');
}

for (let i = 0; i < map.sources.length; i++) {
  const src = map.sources[i];
  const content = map.sourcesContent && map.sourcesContent[i];

  if (typeof content !== 'string') continue;
  if (!src.startsWith('/app/frontend/')) continue;
  if (src.includes('/node_modules/')) continue;

  const rel = src.replace('/app/frontend/', '');
  if (!rel || rel.includes('..')) continue;

  const parts = rel.split('/').map(cleanPathPart);
  const file = path.join(out, ...parts);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  written.push(parts.join('/'));
}

written.sort();
fs.writeFileSync(path.join(out, 'SOURCE_MANIFEST.txt'), `${written.join('\n')}\n`);
console.log(`Extracted ${written.length} app files to ${out}`);
