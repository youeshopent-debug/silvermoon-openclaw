const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', '.silvermoon_core', 'test_writefile.txt');
const content = '银月write_file测试 ' + new Date().toISOString() + '\nline2\nline3';

// 1. fs.writeFileSync
try {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  const size = fs.statSync(filePath).size;
  console.log('✅ 主路径(fs.writeFileSync)成功:', size + ' bytes');
  console.log('内容:', fs.readFileSync(filePath, 'utf-8'));
  process.exit(0);
} catch (err) {
  console.log('主路径失败:', err.message);
}

// 2. 一级降级: exec echo
try {
  const absPath = path.resolve(filePath);
  const escaped = content.replace(/"/g, '\\"');
  execSync('echo "' + escaped + '" > "' + absPath + '"', { timeout: 10000, windowsHide: true, shell: true });
  if (fs.existsSync(absPath) && fs.statSync(absPath).size > 0) {
    const size = fs.statSync(absPath).size;
    console.log('✅ 一级降级(echo)成功:', size + ' bytes');
    console.log('内容:', fs.readFileSync(absPath, 'utf-8'));
    process.exit(0);
  }
} catch (echoErr) {
  console.log('一级降级失败:', echoErr.message);
}

// 3. 二级降级: PowerShell Base64
try {
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  const absPath = path.resolve(filePath);
  const psCmd = `powershell -NoProfile -Command "[System.IO.File]::WriteAllBytes('${absPath}', [System.Convert]::FromBase64String('${b64}'))"`;
  execSync(psCmd, { timeout: 30000, windowsHide: true });
  if (fs.existsSync(absPath)) {
    const size = fs.statSync(absPath).size;
    console.log('✅ 二级降级(PS Base64)成功:', size + ' bytes');
    console.log('内容:', fs.readFileSync(absPath, 'utf-8'));
    process.exit(0);
  }
} catch (fbErr) {
  console.log('二级降级失败:', fbErr.message);
}

console.log('❌ 所有写入方式均失败');
process.exit(1);
