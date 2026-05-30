const fs = require('fs');
const path = require('path');

const samplesDir = path.join(__dirname, '..', 'voice-samples');
const entries = fs.readdirSync(samplesDir, { withFileTypes: true });
const targetDir = entries.find(e => e.isDirectory() && e.name.includes('凡修'));

if (!targetDir) {
  console.error('ERROR: Cannot find 凡修 directory');
  process.exit(1);
}

const dirPath = path.join(samplesDir, targetDir.name);
console.log('Target directory:', dirPath);

const files = fs.readdirSync(dirPath);
console.log('Files found:', files.length);

const renameMap = {
  'BV171WG': 'yy_13min_BV171WGzCEaf',
  'BV19fNkz': 'yy_CVclip_BV19fNkz6Eoi',
  'BV18T5Y6': 'yy_dubbing_BV18T5Y6mEK7',
};

for (const file of files) {
  if (!file.endsWith('.m4a')) continue;
  
  let newName = null;
  for (const [pattern, base] of Object.entries(renameMap)) {
    if (file.includes(pattern)) {
      newName = base + '.m4a';
      break;
    }
  }
  
  if (!newName) {
    // For files with %(ext)s in name, just use the BV ID
    const bvMatch = file.match(/BV[a-zA-Z0-9]+/);
    if (bvMatch) {
      newName = `yy_${bvMatch[0]}.m4a`;
    }
  }
  
  if (newName && newName !== file) {
    const oldPath = path.join(dirPath, file);
    const newPath = path.join(dirPath, newName);
    fs.renameSync(oldPath, newPath);
    console.log(`  RENAMED: "${file}" → "${newName}"`);
  } else if (!newName) {
    console.log(`  SKIPPED: "${file}" (no pattern match)`);
  }
}

// Verify
console.log('\nFinal files:');
for (const f of fs.readdirSync(dirPath).sort()) {
  const stat = fs.statSync(path.join(dirPath, f));
  console.log(`  ${f} (${(stat.size / 1024).toFixed(0)}KB)`);
}
