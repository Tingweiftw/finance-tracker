/**
 * Test script for UOB Lady parser
 * Usage: node scripts/test-parser.mjs examples/uob_lady.pdf
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

// Simplified parser logic for testing
function parseWithLayout(lines, fullText) {
    // Find column positions
    let withdrawalsX = 344;  // Default
    let depositsX = 435;     // Default
    let balanceX = 517;      // Default

    for (const line of lines) {
        const text = line.text;
        if ((text.includes('Withdrawals') || text.includes('Withdrawal')) &&
            (text.includes('Deposits') || text.includes('Deposit'))) {

            const wItem = line.items.find(i =>
                i.str.includes('Withdrawal') || i.str.includes('Withdrawals')
            );
            const dItem = line.items.find(i =>
                i.str === 'Deposits' || i.str === 'Deposit'
            );
            const bItem = line.items.find(i => i.str === 'Balance');

            if (wItem) withdrawalsX = wItem.x;
            if (dItem) depositsX = dItem.x;
            if (bItem) balanceX = bItem.x;

            console.log(`Found headers - Withdrawals:${withdrawalsX}, Deposits:${depositsX}, Balance:${balanceX}`);
            break;
        }
    }

    const transactions = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.text.trim();

        if (!text) continue;

        // Check for transaction date pattern
        const dateMatch = text.match(/^(\d{2}\s+\w{3})\s+/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];

        // Find all number items
        const numberItems = line.items.filter(item => /^-?[\d,]+\.\d{2}$/.test(item.str.trim()));

        if (numberItems.length === 0) continue;

        let withdrawalAmount = 0;
        let depositAmount = 0;
        let balance = 0;

        for (const numItem of numberItems) {
            const x = numItem.x;
            const value = parseFloat(numItem.str.replace(/,/g, ''));

            const distToWithdrawal = Math.abs(x - withdrawalsX);
            const distToDeposit = Math.abs(x - depositsX);
            const distToBalance = Math.abs(x - balanceX);
            const threshold = 80;

            if (distToBalance < threshold && distToBalance < distToWithdrawal && distToBalance < distToDeposit) {
                balance = value;
            } else if (distToWithdrawal < threshold && distToWithdrawal < distToDeposit) {
                withdrawalAmount = value;
            } else if (distToDeposit < threshold) {
                depositAmount = value;
            } else {
                const maxX = Math.max(...numberItems.map(n => n.x));
                if (x === maxX) {
                    balance = value;
                }
            }
        }

        let amount = 0;
        if (withdrawalAmount > 0) {
            amount = -withdrawalAmount;
        } else if (depositAmount > 0) {
            amount = depositAmount;
        }

        if (amount === 0 && numberItems.length === 1) {
            continue;
        }

        // Simple description extraction
        const firstNumX = Math.min(...numberItems.map(n => n.x));
        const descItems = line.items.filter(item => item.x >= 70 && item.x < firstNumX - 10 && item.str.trim() !== '');
        const description = descItems.map(i => i.str).join(' ').replace(dateStr, '').trim();

        transactions.push({
            date: dateStr,
            description: description.substring(0, 50) + (description.length > 50 ? '...' : ''),
            amount,
            balance,
            type: amount < 0 ? 'WITHDRAWAL' : 'DEPOSIT'
        });
    }

    return transactions;
}

async function testParser(filePath) {
    console.log(`\n=== Testing Parser: ${path.basename(filePath)} ===\n`);

    const lines = await extractPDFLayout(filePath);
    const fullText = lines.map(l => l.text).join('\n');

    const transactions = parseWithLayout(lines, fullText);

    console.log(`Found ${transactions.length} transactions:\n`);
    console.log('Date      | Type       | Amount     | Balance    | Description');
    console.log('----------|------------|------------|------------|-----------------------------');

    for (const t of transactions) {
        const amountStr = (t.amount >= 0 ? '+' : '') + t.amount.toFixed(2);
        console.log(`${t.date.padEnd(10)}| ${t.type.padEnd(11)}| ${amountStr.padStart(10)} | ${t.balance.toFixed(2).padStart(10)} | ${t.description}`);
    }

    // Summary
    const withdrawals = transactions.filter(t => t.amount < 0);
    const deposits = transactions.filter(t => t.amount > 0);

    console.log('\n=== Summary ===');
    console.log(`Total Withdrawals: ${withdrawals.length} (Sum: ${withdrawals.reduce((s, t) => s + t.amount, 0).toFixed(2)})`);
    console.log(`Total Deposits: ${deposits.length} (Sum: ${deposits.reduce((s, t) => s + t.amount, 0).toFixed(2)})`);
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node scripts/test-parser.mjs <path-to-pdf>');
    process.exit(1);
}

testParser(filePath).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
