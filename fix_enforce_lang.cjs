'use strict';
const fs = require('fs');
const p = 'C:\\Users\\User\\.openclaw\\main.js';
let s = fs.readFileSync(p, 'utf8');

// 1. punch() 占位符格式: §H -> \x01 (SOH, 非字母非数字, 不会被英文正则匹配)
const oldKey = 'const key = `\u00a7H${holes.length}\u00a7`;';
const newKey = 'const key = `\x01${holes.length}\x01`;';
if (s.includes(oldKey)) {
  s = s.replace(oldKey, newKey);
  console.log('1. punch key: \u00a7H -> \\x01');
} else {
  console.log('1. punch key: NOT FOUND');
}

// 2. restore 正则
const oldRestore = 's.replace(/\u00a7H(\\d+)\u00a7/g';
const newRestore = 's.replace(/\\x01(\\d+)\\x01/g';
if (s.includes(oldRestore)) {
  s = s.replace(oldRestore, newRestore);
  console.log('2. restore regex: \u00a7H\\d+ -> \\x01\\d+\\x01');
} else {
  console.log('2. restore regex: NOT FOUND');
}

// 3. 插入 UI/UX punch 保护
const target = '  punch(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z/g);\n\n  if (mode ===';
const repl = '  punch(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z/g);\n  punch(/\\bUI\\b/g);\n  punch(/\\bUX\\b/g);\n\n  if (mode ===';
if (s.includes(target)) {
  s = s.replace(target, repl);
  console.log('3. UI/UX punch inserted');
} else {
  console.log('3. UI/UX target NOT FOUND');
}

fs.writeFileSync(p, s, 'utf8');
console.log('Written. Verifying...');

const v = fs.readFileSync(p, 'utf8');
console.log('  punch key:', v.includes('const key = `\x01') ? 'OK' : 'FAIL');
console.log('  restore:', v.includes('/\\x01(\\d+)\\x01/g') ? 'OK' : 'FAIL');
console.log('  UI punch:', v.includes('punch(/\\bUI\\b/g)') ? 'OK' : 'FAIL');
console.log('  UX punch:', v.includes('punch(/\\bUX\\b/g)') ? 'OK' : 'FAIL');
