const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist');
const zipName = 'neis-copy-fairy.zip';
const zipPath = path.join(outDir, zipName);

const include = [
  'manifest.json',
  'background',
  'content',
  'popup',
  'lib',
  'icons',
];

fs.mkdirSync(outDir, { recursive: true });

const staging = path.join(outDir, 'neis-copy-fairy');
if (fs.existsSync(staging)) {
  fs.rmSync(staging, { recursive: true, force: true });
}
fs.mkdirSync(staging, { recursive: true });

for (const item of include) {
  const src = path.join(root, item);
  const dest = path.join(staging, item);
  fs.cpSync(src, dest, { recursive: true });
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${staging}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

fs.rmSync(staging, { recursive: true, force: true });
console.log(`\n배포용 ZIP 생성: ${zipPath}`);
