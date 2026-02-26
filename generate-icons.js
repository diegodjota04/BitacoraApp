/**
 * Script para generar todos los íconos PWA necesarios
 * Ejecutar con: node generate-icons.js
 * Requiere: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFile = path.join(__dirname, 'icons', 'icon-512x512.png');
const outputDir = path.join(__dirname, 'icons');

async function generateIcons() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
        // Si ya existe, no sobreescribir
        if (fs.existsSync(outputPath) && size !== 512) {
            await sharp(inputFile)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            console.log(`✓ Generado: icon-${size}x${size}.png`);
        }
    }
    console.log('\n✅ Todos los íconos generados correctamente en /icons/');
}

generateIcons().catch(console.error);
