const fs = require('fs');
const path = require('path');

const BASE = 'c:\\Users\\User\\.openclaw\\.trae\\skills\\trae-skills';

function flatten(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(flatten(full));
    else if (e.name.endsWith('.md')) files.push(full);
  }
  return files;
}

const allMd = flatten(BASE);
console.log(`Found ${allMd.length} .md files to restructure\n`);

let count = 0;
for (const filePath of allMd) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath, '.md');

  // Skip if this is a directory root (already restructured)
  if (fileName === 'SKILL') continue;

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if already has YAML frontmatter
  const hasYaml = content.startsWith('---\n');

  // Check if it's README.md in other/
  if (dir.endsWith('other')) continue;

  // Determine skill name from filename
  const skillName = fileName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bVs\b/i, 'vs').replace(/\bAnd\b/i, 'and').replace(/\bOf\b/i, 'of').replace(/\bIn\b/i, 'in');
  const skillId = 'trae-skills-' + fileName.replace(/_/g, '-').toLowerCase();

  // Create skill directory alongside the old one
  const parentDir = path.dirname(dir);
  const skillDir = path.join(parentDir, skillId);
  const targetFile = path.join(skillDir, 'SKILL.md');

  fs.mkdirSync(skillDir, { recursive: true });

  if (!hasYaml) {
    const newContent = `---
name: ${skillId}
description: ${skillName} - TRAE-Skills reference guide
---

${content}`;
    fs.writeFileSync(targetFile, newContent, 'utf-8');
  } else {
    fs.writeFileSync(targetFile, content, 'utf-8');
  }

  // Remove old file
  fs.unlinkSync(filePath);

  count++;
  if (count % 20 === 0) process.stdout.write(`\rRestructured ${count}/${allMd.length}...`);
}

// Remove empty directories
function removeEmptyDirs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      removeEmptyDirs(full);
      const remaining = fs.readdirSync(full);
      if (remaining.length === 0) fs.rmdirSync(full);
    }
  }
}

removeEmptyDirs(BASE);
console.log(`\nDone! ${count} skills restructured successfully`);
