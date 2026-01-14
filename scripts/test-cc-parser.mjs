/**
 * Test script for UOB Credit Card parser
 * Usage: node scripts/test-cc-parser.mjs examples/uob_cc.pdf
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

async function extractPDFLayout(filePath) {
    const pdfjs = await loadPdfJs();

    const absolutePath = path.resolve(filePath);
    const data = new Uint8Array(fs.readFileSync(absolutePath));
    const pdf = await pdfjs.getDocument({ data }).promise;

    const allLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
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
                x: item.transform[4],
                y: item.transform[5]
            });
        });

        // Sort Y descending (top to bottom)
        const sortedY = Object.keys(yMap).map(Number).sort((a, b) => b - a);

        sortedY.forEach(y => {
            const lineItems = yMap[y].sort((a, b) => a.x - b.x);
            const text = lineItems.map(i => i.str).join('  ');
            allLines.push({
                y,
                items: lineItems,
                text
            });
        });
    }

    return allLines;
}

// Card name patterns
const CARD_PATTERNS = [
    /^UOB ONE CARD$/i,
    /^LADY'S CARD$/i,
    /^UOB PRIVI MILES CARD$/i,
    /^UOB VISA SIGNATURE CARD$/i,
];

// Lines to skip
const SKIP_PATTERNS = [
    /^PREVIOUS BALANCE$/i,
    /^PAYMT THRU E-BANK/i,
    /^PAYMENT.*RECEIVED/i,
    /^CREDIT ADJUSTMENT/i,
    /^SUB TOTAL$/i,
    /^TOTAL BALANCE FOR/i,
];

function detectCardHeader(text) {
    const trimmed = text.trim();
    for (const pattern of CARD_PATTERNS) {
        if (pattern.test(trimmed)) {
            return trimmed;
        }
    }
    return null;
}

function shouldSkipLine(text) {
    const trimmed = text.trim();
    for (const pattern of SKIP_PATTERNS) {
        if (pattern.test(trimmed)) {
            return true;
        }
    }

    if (trimmed.includes('United Overseas Bank') ||
        trimmed.includes('请注意') ||
        trimmed.includes('Please note that you are bound') ||
        (trimmed.includes('Page ') && trimmed.includes(' of '))) {
        return true;
    }

    return false;
}

function parseStatementDate(dateStr, year) {
    const months = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
    };

    const parts = dateStr.trim().split(/\s+/);
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '01';

    return `${year}-${month}-${day}`;
}

function parseCreditCardStatement(lines, fullText) {
    const transactions = [];
    let currentCardName = '';
    const currentYear = 2025; // Hardcoded for test

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.text.trim();

        if (!text) continue;

        // Check for card section header
        const cardMatch = detectCardHeader(text);
        if (cardMatch) {
            currentCardName = cardMatch;
            // Skip card number line
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].text.trim();
                if (/^\d{4}-\d{4}-\d{4}-\d{4}/.test(nextLine)) {
                    i++;
                }
            }
            continue;
        }

        // Skip unwanted lines
        if (shouldSkipLine(text)) {
            continue;
        }

        // Skip Ref No. lines
        if (text.startsWith('Ref No.')) {
            continue;
        }

        // Skip foreign currency lines (they follow transactions)
        if (/^[A-Z]{3}\s+[\d,.]+$/.test(text)) {
            // Attach to last transaction's description
            if (transactions.length > 0) {
                const match = text.match(/^([A-Z]{3})\s+([\d,.]+)$/);
                if (match) {
                    transactions[transactions.length - 1].description += ` (${match[1]} ${match[2]})`;
                }
            }
            continue;
        }

        // Parse transaction with date pattern
        const dateMatch = text.match(/^(\d{2}\s+\w{3})/);
        if (dateMatch && currentCardName) {
            // Check for amounts in this line
            const numberItems = line.items.filter(item => /^[\d,]+\.\d{2}$/.test(item.str.trim()));

            if (numberItems.length > 0) {
                // Get the last number as amount
                const amountItem = numberItems[numberItems.length - 1];
                let amount = parseFloat(amountItem.str.replace(/,/g, ''));

                // Check for CR suffix (refund)
                const isCreditRefund = line.items.some(item => item.str.trim() === 'CR');

                // Make expense negative
                if (!isCreditRefund) {
                    amount = -Math.abs(amount);
                }

                // Get description (items between dates and amount)
                const dateItems = line.items.filter(item => /^\d{2}\s+\w{3}$/.test(item.str.trim()));
                const transDate = dateItems.length >= 2 ? dateItems[1].str.trim() : dateItems[0].str.trim();

                // Find description area (after second date, before amount)
                const amountX = amountItem.x;
                const descItems = line.items.filter(item => {
                    const str = item.str.trim();
                    if (/^\d{2}\s+\w{3}$/.test(str)) return false;
                    if (/^[\d,]+\.\d{2}$/.test(str)) return false;
                    if (str === 'CR') return false;
                    if (str.length === 0) return false;
                    // Must be before the amount
                    return item.x < amountX;
                });

                const description = descItems.map(i => i.str).join(' ').trim();

                if (description && !shouldSkipLine(description)) {
                    transactions.push({
                        date: parseStatementDate(transDate, currentYear),
                        description,
                        amount,
                        cardName: currentCardName,
                        type: amount < 0 ? 'EXPENSE' : 'REFUND'
                    });
                }
            }
        }
    }

    // Deduplicate
    const seen = new Set();
    return transactions.filter(tx => {
        const key = `${tx.date}|${tx.description}|${tx.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function testParser(filePath) {
    console.log(`\n=== Testing Credit Card Parser: ${path.basename(filePath)} ===\n`);

    const lines = await extractPDFLayout(filePath);
    const fullText = lines.map(l => l.text).join('\n');

    const transactions = parseCreditCardStatement(lines, fullText);

    // Group by card
    const byCard = {};
    for (const tx of transactions) {
        if (!byCard[tx.cardName]) byCard[tx.cardName] = [];
        byCard[tx.cardName].push(tx);
    }

    console.log(`Found ${transactions.length} transactions across ${Object.keys(byCard).length} cards\n`);

    for (const [cardName, txs] of Object.entries(byCard)) {
        console.log(`\n=== ${cardName} (${txs.length} transactions) ===\n`);
        console.log('Date        | Type     | Amount     | Description');
        console.log('------------|----------|------------|-----------------------------');

        for (const t of txs.slice(0, 15)) { // Show first 15 per card
            const amountStr = (t.amount >= 0 ? '+' : '') + t.amount.toFixed(2);
            const desc = t.description.substring(0, 35) + (t.description.length > 35 ? '...' : '');
            console.log(`${t.date} | ${t.type.padEnd(8)} | ${amountStr.padStart(10)} | ${desc}`);
        }

        if (txs.length > 15) {
            console.log(`... and ${txs.length - 15} more transactions`);
        }

        const totalExpenses = txs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
        const totalRefunds = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        console.log(`\nCard Summary: Expenses: ${totalExpenses.toFixed(2)}, Refunds: ${totalRefunds.toFixed(2)}`);
    }

    // Overall summary
    const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    console.log(`\n=== Overall Summary ===`);
    console.log(`Total Transactions: ${transactions.length}`);
    console.log(`Total Expenses: SGD ${Math.abs(totalExpenses).toFixed(2)}`);
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node scripts/test-cc-parser.mjs <path-to-pdf>');
    process.exit(1);
}

testParser(filePath).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
