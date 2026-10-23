// 构建时生成 PWA 图标（纯 Node.js，无第三方依赖）
// 用法：node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// CRC32 表
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}

function drawIcon(size) {
  // RGB 像素缓冲
  const px = Buffer.alloc(size * size * 3);
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  // 蓝色渐变背景 #2563eb -> #1e40af
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(37 + (30 - 37) * t);
    const g = Math.round(99 + (64 - 99) * t);
    const b = Math.round(235 + (175 - 235) * t);
    for (let x = 0; x < size; x++) set(x, y, r, g, b);
  }
  // 中央白色圆角档案盒
  const m = size / 2;
  const w = size * 0.52, h = size * 0.42, rad = size * 0.09;
  const x0 = m - w / 2, y0 = m - h / 2, x1 = m + w / 2, y1 = m + h / 2;
  const inRound = (x, y) => {
    if (x >= x0 + rad && x <= x1 - rad) return y >= y0 && y <= y1;
    if (y >= y0 + rad && y <= y1 - rad) return x >= x0 && x <= x1;
    const cx = x < x0 + rad ? x0 + rad : x1 - rad;
    const cy = y < y0 + rad ? y0 + rad : y1 - rad;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
      if (inRound(x, y)) set(x, y, 255, 255, 255);
  // 盒盖分隔线 + 三条内容线
  const line = (x0l, x1l, yy, ww, r, g, b) => {
    for (let x = Math.floor(x0l); x <= Math.ceil(x1l); x++)
      for (let k = -Math.floor(ww / 2); k <= Math.ceil(ww / 2); k++)
        set(x, Math.round(yy) + k, r, g, b);
  };
  const ly = y0 + h * 0.32;
  line(x0 + rad / 2, x1 - rad / 2, ly, size * 0.035, 37, 99, 235);
  for (let i = 0; i < 3; i++) {
    const yy = ly + h * 0.24 + i * size * 0.075;
    line(x0 + w * 0.18, x1 - w * 0.18, yy, size * 0.03, 147, 197, 253);
  }
  // 组装 PNG（filter 0）
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0;
    px.copy(raw, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(join(outDir, name), drawIcon(size));
  console.log("generated", name);
}
