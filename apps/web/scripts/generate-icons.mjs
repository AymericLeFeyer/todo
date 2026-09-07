import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Génère les icônes de la PWA (fond plein + coche) sans dépendance externe :
 * une icône est indispensable pour l'ajout à l'écran d'accueil iOS, et elle
 * doit rester stable dans le dépôt plutôt que d'être produite au build.
 *
 * Usage : node scripts/generate-icons.mjs
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BACKGROUND = [214, 62, 48]; // rouge de la couleur primaire
const FOREGROUND = [255, 255, 255];

function createCanvas(size) {
  const pixels = new Uint8Array(size * size * 4);
  return {
    size,
    pixels,
    set(x, y, [r, g, b], alpha = 255) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const offset = (y * size + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = alpha;
    },
  };
}

/** Fond : carré plein pour les icônes maskable, coins arrondis sinon. */
function fillBackground(canvas, radiusRatio) {
  const { size } = canvas;
  const radius = size * radiusRatio;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.max(radius - x, 0, x - (size - radius - 1));
      const dy = Math.max(radius - y, 0, y - (size - radius - 1));
      const outside = Math.hypot(dx, dy) - radius;
      if (outside <= 0) canvas.set(x, y, BACKGROUND);
      else if (outside < 1) canvas.set(x, y, BACKGROUND, Math.round(255 * (1 - outside)));
    }
  }
}

function drawSegment(canvas, from, to, thickness) {
  const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 2);
  const half = thickness / 2;

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const cx = from[0] + (to[0] - from[0]) * t;
    const cy = from[1] + (to[1] - from[1]) * t;

    for (let y = Math.floor(cy - half); y <= Math.ceil(cy + half); y += 1) {
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x += 1) {
        const distance = Math.hypot(x - cx, y - cy);
        if (distance <= half - 0.5) canvas.set(x, y, FOREGROUND);
        else if (distance < half + 0.5) {
          canvas.set(x, y, FOREGROUND, Math.round(255 * (half + 0.5 - distance)));
        }
      }
    }
  }
}

/** Coche centrée, dimensionnée en fraction de l'icône. */
function drawCheck(canvas, scale) {
  const { size } = canvas;
  const center = size / 2;
  const unit = size * scale;
  const thickness = unit * 0.22;

  drawSegment(
    canvas,
    [center - unit * 0.45, center + unit * 0.02],
    [center - unit * 0.12, center + unit * 0.34],
    thickness,
  );
  drawSegment(
    canvas,
    [center - unit * 0.12, center + unit * 0.34],
    [center + unit * 0.45, center - unit * 0.32],
    thickness,
  );
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(canvas) {
  const { size, pixels } = canvas;

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // profondeur
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filtre « none »
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function generate(name, size, { radiusRatio, checkScale }) {
  const canvas = createCanvas(size);
  fillBackground(canvas, radiusRatio);
  drawCheck(canvas, checkScale);
  writeFileSync(join(OUT_DIR, name), encodePng(canvas));
  console.log(`${name} (${size}x${size})`);
}

mkdirSync(OUT_DIR, { recursive: true });
generate('icon-192.png', 192, { radiusRatio: 0.22, checkScale: 0.62 });
generate('icon-512.png', 512, { radiusRatio: 0.22, checkScale: 0.62 });
// Maskable : la zone de sécurité impose un motif réduit et un fond plein.
generate('icon-maskable-512.png', 512, { radiusRatio: 0, checkScale: 0.44 });
// iOS applique lui-même le masque arrondi et n'accepte pas la transparence.
generate('apple-touch-icon.png', 180, { radiusRatio: 0, checkScale: 0.6 });
