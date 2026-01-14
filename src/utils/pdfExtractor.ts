/**
 * PDF Text Extractor using browser-based PDF.js loaded from CDN
 * Avoids npm module issues by dynamically loading the library
 */

// PDF.js library version to use
const PDFJS_VERSION = '4.9.155';
const PDFJS_CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

// Cache the loaded library
let pdfjsLib: any = null;

/**
 * Load PDF.js library from CDN
 */
async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) {
        return pdfjsLib;
    }

    try {
        // Dynamic import from CDN
        const pdfjs = await import(/* @vite-ignore */ PDFJS_CDN_URL);
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        pdfjsLib = pdfjs;
        return pdfjsLib;
    } catch (error) {
        console.error('Failed to load PDF.js from CDN:', error);
        throw new Error('Failed to load PDF parsing library. Please check your internet connection.');
    }
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
    const pdfjs = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Group items by vertical position (Y coordinate) to reconstruct lines reliably
        const items = content.items as any[];
        const yMap: Record<number, any[]> = {};

        items.forEach((item: any) => {
            // Round Y to handle slight alignment variations (e.g. 1px diff)
            const y = Math.round(item.transform[5] / 2) * 2;
            if (!yMap[y]) yMap[y] = [];
            yMap[y].push(item);
        });

        // Sort Y from top to bottom
        const sortedY = Object.keys(yMap).map(Number).sort((a, b) => b - a);

        sortedY.forEach(y => {
            // Sort items on the same line from left to right
            const lineItems = yMap[y].sort((a: any, b: any) => a.transform[4] - b.transform[4]);
            const lineText = lineItems.map((item: any) => item.str).join('  '); // Double space as column anchor
            fullText += lineText + '\n';
        });
    }

    return fullText;
}

export interface PDFItem {
    str: string;
    x: number;
    y: number;
    // width might be useful but PDF.js items don't always give simple width. transform[0] is scaling.
}

export interface PDFLine {
    y: number;
    items: PDFItem[];
    text: string; // convenience
}

export async function extractPDFLayout(file: File): Promise<PDFLine[]> {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    const allLines: PDFLine[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const items = content.items as any[];

        // Group by Y
        const yMap: Record<number, any[]> = {};
        items.forEach((item: any) => {
            // Round Y (PDF coords: 0,0 is bottom-left usually, or top-left depending on view? PDF.js is math coords usually)
            // But we just need grouping.
            const y = Math.round(item.transform[5]);
            if (!yMap[y]) yMap[y] = [];
            yMap[y].push(item);
        });

        // Parse into Lines
        // Sort Y descending (Top to Bottom for standard reading)
        const sortedY = Object.keys(yMap).map(Number).sort((a, b) => b - a);

        sortedY.forEach(y => {
            // Sort X ascending (Left to Right)
            const lineItems = yMap[y].sort((a: any, b: any) => a.transform[4] - b.transform[4]);

            const pdfItems: PDFItem[] = lineItems.map((item: any) => ({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5]
            }));

            const text = pdfItems.map(pi => pi.str).join('  ');

            allLines.push({
                y, // might need page offset if strict Y matters across pages, but usually not for column detection
                items: pdfItems,
                text
            });
        });
    }

    return allLines;
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
