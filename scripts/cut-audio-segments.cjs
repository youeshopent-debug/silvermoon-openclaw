/**
 * cut-audio-segments.cjs
 * Cut reference audio segments from 凡修-银月 source files for Fish Speech voice cloning.
 *
 * Usage: node scripts\cut-audio-segments.cjs [dirname]
 *   dirname - optional, defaults to '凡修-银月'
 *
 * Avoids Chinese-character path detection bugs in cmd.exe by accepting
 * the directory name as a CLI argument.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const samplesDir = path.join(__dirname, '..', 'voice-samples');

// Accept dir name as CLI arg, default to '凡修-银月'
const targetDirName = process.argv[2] || '凡修-银月';
let dirPath = path.join(samplesDir, targetDirName);

// If direct path doesn't exist, fallback: scan for first subdirectory
if (!fs.existsSync(dirPath)) {
  console.warn(`WARN: Path "${dirPath}" not found, scanning for alternatives...`);
  const entries = fs.readdirSync(samplesDir, { withFileTypes: true });
  const firstSubdir = entries.find(e => e.isDirectory() && e.name !== 'yin-yue');
  if (!firstSubdir) {
    console.error('ERROR: No suitable voice-samples subdirectory found.');
    console.error('Available entries:');
    for (const e of entries) {
      console.error(`  ${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`);
    }
    process.exit(1);
  }
  dirPath = path.join(samplesDir, firstSubdir.name);
  console.warn(`  → Using fallback: ${dirPath}`);
}

const segDir = path.join(dirPath, 'segments');
if (!fs.existsSync(segDir)) {
  fs.mkdirSync(segDir, { recursive: true });
}

console.log('Source dir:', dirPath);
console.log('Segments dir:', segDir);

// ---- Step 1: Cut 4 segments from the 13min 素材 ----
const source13min = path.join(dirPath, 'yy_13min_BV171WGzCEaf.wav');

const segments = [
  [0, 25, 'seg1_early_25s'],
  [30, 25, 'seg2_mid_25s'],
  [464, 25, 'seg3_mid2_25s'],
  [601, 25, 'seg4_late_25s'],
];

if (fs.existsSync(source13min)) {
  for (const [start, dur, name] of segments) {
    const outFile = path.join(segDir, `${name}.wav`);
    // Use -c copy for speed (only works for same codec, WAV → WAV is fine)
    const cmd = `ffmpeg -i "${source13min}" -ss ${start} -t ${dur} -c copy "${outFile}" -y 2>&1`;
    console.log(`Cutting ${name} (${start}s +${dur}s)...`);
    try {
      execSync(cmd, { timeout: 30000, shell: 'cmd.exe', stdio: ['ignore', 'pipe', 'pipe'] });
      const size = fs.statSync(outFile).size;
      console.log(`  → ${outFile} (${(size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }
} else {
  console.warn(`WARN: Source file not found: ${source13min}`);
  console.warn('  Available files in source dir:');
  for (const f of fs.readdirSync(dirPath)) {
    console.warn(`    ${f}`);
  }
}

// ---- Step 2: Copy shorter clips as reference segments ----
const clipsToCopy = [
  ['yy_CVclip_BV19fNkz6Eoi.wav', 'seg5_CV_22s.wav'],
  ['yy_dubbing_BV18T5Y6mEK7.wav', 'seg6_dubbing_52s.wav'],
];

for (const [src, dst] of clipsToCopy) {
  const srcPath = path.join(dirPath, src);
  const dstPath = path.join(segDir, dst);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  SKIP ${src} → not found`);
    continue;
  }
  fs.copyFileSync(srcPath, dstPath);
  const size = fs.statSync(dstPath).size;
  console.log(`Copied ${src} → ${dst} (${(size / 1024).toFixed(0)} KB)`);
}

// ---- Step 3: List all segments ----
console.log('\n=== All segments ===');
const segFiles = fs.existsSync(segDir) ? fs.readdirSync(segDir).sort() : [];
if (segFiles.length === 0) {
  console.log('  (no segments created)');
} else {
  for (const f of segFiles) {
    const stat = fs.statSync(path.join(segDir, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(0)} KB)`);
  }
}
