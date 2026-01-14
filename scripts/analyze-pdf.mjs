/**
 * Script to analyze PDF structure for parser development
 * Usage: node scripts/analyze-pdf.mjs examples/uob_lady.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for pdf.js
async function loadPdfJs() {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return pdfjsLib;
}

async function analyzePDF(filePath) {
    const pdfjs = await loadPdfJs();

    const absolutePath = path.resolve(filePath);
    const data = new Uint8Array(fs.readFileSync(absolutePath));
    const pdf = await pdfjs.getDocument({ data }).promise;

    console.log(`\n=== PDF Analysis: ${path.basename(filePath)} ===`);
    console.log(`Total Pages: ${pdf.numPages}\n`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`\n--- Page ${pageNum} ---\n`);

        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const items = content.items;

        // Group by Y coordinate
        const yMap = {};
        items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!yMap[y]) yMap[y] = [];
            yMap[y].push({
                str: item.str,
                x: Math.round(item.transform[4]),
                y: y,
                width: Math.round(item.width || 0)
            });
        });

        // Sort Y descending (top to bottom)
        const sortedY = Object.keys(yMap).map(Number).sort((a, b) => b - a);

        sortedY.forEach(y => {
            const lineItems = yMap[y].sort((a, b) => a.x - b.x);

            // Print each item with its X position
            const itemStrs = lineItems.map(item => `[x:${item.x}] "${item.str}"`);
            console.log(`Y=${y}: ${itemStrs.join('  ')}`);
        });
    }
}

// Get file path from command line
const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node scripts/analyze-pdf.mjs <path-to-pdf>');
    process.exit(1);
}

analyzePDF(filePath).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
