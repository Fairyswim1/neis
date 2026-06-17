/**
 * Chrome 웹 스토어 스크린샷 크기 맞추기
 * 사용: node scripts/resize-store-screenshot.js <입력.png> [출력.png] [1280|640]
 *
 * 예: node scripts/resize-store-screenshot.js capture.png store-1280.png 1280
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = process.argv[2];
const output = process.argv[3] || 'dist/store-screenshot.png';
const sizeKey = process.argv[4] || '1280';

const SIZES = {
  '1280': { w: 1280, h: 800 },
  '640': { w: 640, h: 400 },
};

async function main() {
  if (!input || !fs.existsSync(input)) {
    console.error('사용법: node scripts/resize-store-screenshot.js <입력.png> [출력.png] [1280|640]');
    process.exit(1);
  }

  const { w, h } = SIZES[sizeKey] || SIZES['1280'];
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });

  const meta = await sharp(input).metadata();
  console.log(`입력: ${meta.width}x${meta.height} → 출력: ${w}x${h}`);

  await sharp(input)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(output);

  const out = await sharp(output).metadata();
  console.log(`완료: ${path.resolve(output)} (${out.width}x${out.height})`);
  console.log('Chrome 웹 스토어에 이 파일을 업로드하세요.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
