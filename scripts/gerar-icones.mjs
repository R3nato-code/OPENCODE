import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const destino = dirname(fileURLToPath(import.meta.url)) + '/../icons';

// ------------------------------------------------------------ PNG

const tabelaCRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = tabelaCRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const tipoEhDados = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tipoEhDados));
  return Buffer.concat([len, tipoEhDados, crc]);
}

function pngBuffer(largura, altura, rgba) {
  const bruto = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y++) {
    bruto[y * (largura * 4 + 1)] = 0;
    rgba.copy(bruto, y * (largura * 4 + 1) + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(bruto, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ------------------------------------------------------------ desenho

const VERDE = [23, 88, 86, 255];
const BRANCO = [255, 255, 255, 255];
const AMBAR = [232, 165, 53, 255];

function tela(tam) {
  const px = Buffer.alloc(tam * tam * 4);
  const put = (fx, fy, cor) => {
    const x = Math.round(fx), y = Math.round(fy);
    if (x < 0 || y < 0 || x >= tam || y >= tam) return;
    const i = (y * tam + x) * 4;
    px[i] = cor[0]; px[i + 1] = cor[1]; px[i + 2] = cor[2]; px[i + 3] = cor[3];
  };
  const retangulo = (rx, ry, rw, rh, r, cor) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        const dx = Math.max(rx + r - x, x - (rx + rw - 1 - r), 0);
        const dy = Math.max(ry + r - y, y - (ry + rh - 1 - r), 0);
        if (dx * dx + dy * dy <= r * r) put(x, y, cor);
      }
    }
  };
  return { px, put, retangulo };
}

function desenhar(tam, margem, cantos) {
  const d = tela(tam);
  const area = tam - margem * 2;
  d.retangulo(margem, margem, area, area, cantos, VERDE);
  const f = tam / 512;
  const pad = margem + tam * 0.12;
  const w = tam * 0.38 - cantos * 0.4;
  const h = tam * 0.15;
  const gap = tam * 0.07;
  const lx = pad, rx = pad + w + gap;
  const y1 = pad, y2 = pad + h + gap;
  d.retangulo(lx, y1, w, h, Math.max(2, 6 * f), BRANCO);
  d.retangulo(rx, y1, w, h, Math.max(2, 6 * f), AMBAR);
  d.retangulo(lx, y2, w, h, Math.max(2, 6 * f), BRANCO);
  d.retangulo(rx, y2, w, h, Math.max(2, 6 * f), BRANCO);
  return d.px;
}

writeFileSync(`${destino}/icon-192.png`, pngBuffer(192, 192, desenhar(192, 10, Math.round(192 * 0.22))));
writeFileSync(`${destino}/icon-512.png`, pngBuffer(512, 512, desenhar(512, 28, Math.round(512 * 0.22))));
writeFileSync(`${destino}/maskable-512.png`, pngBuffer(512, 512, desenhar(512, 0, 0)));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#175856"/>
<rect x="128" y="152" width="130" height="66" rx="26" fill="#fff"/>
<rect x="278" y="152" width="130" height="66" rx="26" fill="#e8a535"/>
<rect x="128" y="242" width="130" height="66" rx="26" fill="#fff" opacity=".72"/>
<rect x="278" y="242" width="130" height="66" rx="26" fill="#fff"/>
</svg>`;
writeFileSync(`${destino}/favicon.svg`, favicon);

console.log('Ícones gerados em /icons');
