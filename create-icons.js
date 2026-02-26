/**
 * Crea íconos PWA mínimos válidos usando solo módulos nativos de Node.js
 * Genera íconos PNG de colores sólidos (#1a1a2e) en todos los tamaños necesarios
 * Ejecutar: node create-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/* ─── Helpers PNG ─────────────────────────────────────────────────────────── */
function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n >>> 0, 0);
    return b;
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32(Buffer.concat([t, d]));
    return Buffer.concat([u32(d.length), t, d, u32(crc)]);
}

function buildPNG(size) {
    // IHDR: width, height, bit depth 8, color type 2 (RGB), compress/filter/interlace 0
    const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 2, 0, 0, 0])]);

    // Generar datos de imagen
    // Colores del gradiente (esquina a esquina): de #1a1a2e (arriba) a #667eea (abajo)
    const rowSize = 1 + size * 3; // filter byte + RGB por píxel
    const raw = Buffer.alloc(size * rowSize);

    for (let y = 0; y < size; y++) {
        const t = y / (size - 1); // 0.0 arriba → 1.0 abajo
        const R = Math.round(0x1a + (0x66 - 0x1a) * t);
        const G = Math.round(0x1a + (0x7e - 0x1a) * t);
        const B = Math.round(0x2e + (0xea - 0x2e) * t);
        const rowStart = y * rowSize;
        raw[rowStart] = 0; // filter: None
        for (let x = 0; x < size; x++) {
            const isCircle = (x - size / 2) ** 2 + (y - size / 2) ** 2 <= (size / 2) ** 2;
            const off = rowStart + 1 + x * 3;
            if (isCircle) {
                // Dentro del círculo: gradiente azul → púrpura
                raw[off] = R;
                raw[off + 1] = G;
                raw[off + 2] = B;
            } else {
                // Fuera del círculo: fondo oscuro
                raw[off] = 0x0f;
                raw[off + 1] = 0x0f;
                raw[off + 2] = 0x1e;
            }
        }

        // Dibujar elementos: libro blanco en el centro
        const bookW = Math.floor(size * 0.44), bookH = Math.floor(size * 0.30);
        const bookX = Math.floor((size - bookW) / 2);
        const bookY = Math.floor(size * 0.38);
        if (y >= bookY && y < bookY + bookH) {
            for (let x = bookX; x < bookX + bookW; x++) {
                const off = rowStart + 1 + x * 3;
                if (Math.abs(x - size / 2) < 1.5) {
                    // Línea divisoria (azul claro)
                    raw[off] = 0x90; raw[off + 1] = 0xb0; raw[off + 2] = 0xe0;
                } else {
                    raw[off] = 0xff; raw[off + 1] = 0xff; raw[off + 2] = 0xff;
                }
            }
        }

        // Birrete encima del libro (dorado)
        const capW = Math.floor(size * 0.28);
        const capX = Math.floor((size - capW) / 2);
        const capY1 = bookY - Math.floor(size * 0.10);
        const capY2 = bookY - Math.floor(size * 0.04);
        if (y >= capY1 && y < capY2) {
            for (let x = capX; x < capX + capW; x++) {
                const off = rowStart + 1 + x * 3;
                raw[off] = 0xff; raw[off + 1] = 0xcc; raw[off + 2] = 0x00;
            }
        }
        // Parte superior del birrete (diamante pequeño)
        const dY = Math.floor(size * 0.25);
        const dSize = Math.floor(size * 0.07);
        if (y >= dY - dSize && y < dY) {
            const hw = dSize - Math.abs(y - dY + 1);
            for (let x = Math.floor(size / 2 - hw); x <= Math.floor(size / 2 + hw); x++) {
                const off = rowStart + 1 + x * 3;
                raw[off] = 0xff; raw[off + 1] = 0xcc; raw[off + 2] = 0x00;
            }
        }
    }

    const idat = zlib.deflateSync(raw, { level: 6 });

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

/* ─── Generar todos los tamaños ─────────────────────────────────────────────── */
console.log('Generando íconos PWA...\n');
for (const size of sizes) {
    const png = buildPNG(size);
    const dest = path.join(outDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(dest, png);
    const kb = (png.length / 1024).toFixed(1);
    console.log(`  ✓ icon-${size}x${size}.png  (${kb} KB)`);
}
console.log(`\n✅ ¡${sizes.length} íconos creados en ./icons/`);
