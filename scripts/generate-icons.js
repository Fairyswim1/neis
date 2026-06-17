const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '..', 'icons', 'source-fairy.png');
const outDir = path.join(__dirname, '..', 'icons');

async function main() {
  for (const size of [16, 48, 128]) {
    await sharp(src)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon${size}.png`));
  }
  console.log('요정 아이콘 생성 완료 (16, 48, 128)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
