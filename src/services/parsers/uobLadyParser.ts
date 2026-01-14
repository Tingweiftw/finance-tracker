/**
 * UOB Lady's Savings Statement Parser
 * Parses text extracted from UOB Lady's Savings PDF statements
 * Uses layout-aware parsing based on X-coordinates
 */

import type { ParserInput } from './index';
import type { PDFLine } from '@/utils/pdfExtractor';

export interface ParsedStatement {
    openingBalance: number;
    closingBalance: number;
    periodStart: string; // YYYY-MM-DD
    periodEnd: string;   // YYYY-MM-DD
    currency: string;
    accountNumber: string;
    transactions: {
        date: string;      // YYYY-MM-DD
        description: string;
        amount: number;    // positive = credit, negative = debit
        balance: number;   // running balance
    }[];
}

export function parseUOBLadyStatement(input: ParserInput): ParsedStatement {
    if (input.lines && input.lines.length > 0) {
        return parseWithLayout(input.lines, input.text);
    }
    return parseTextOnly(input.text);
}

function parseWithLayout(lines: PDFLine[], fullText: string): ParsedStatement {
    // UOB Lady's Savings PDF layout (from analysis):
    // Header: Date x:52, Description x:120, Withdrawals x:344, Deposits x:435, Balance x:517
    // Transaction amounts appear at:
    //   - Withdrawals: x ~ 367-371
    //   - Deposits: x ~ 446-451  
    //   - Balance: x ~ 510-521

    let withdrawalsX = 0;
    let depositsX = 0;
    let balanceX = 0;

    // Scan for header line containing "Withdrawals" and "Deposits"
    for (const line of lines) {
        const text = line.text;
        // Look for the line with column headers (note: plural "Withdrawals" and "Deposits")
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

            console.log(`UOB Lady Parser: Found headers - Withdrawals:${withdrawalsX}, Deposits:${depositsX}, Balance:${balanceX}`);
            break;
        }
    }

    // Fallback to hardcoded positions from PDF analysis if headers not found
    if (withdrawalsX === 0 || depositsX === 0) {
        console.warn('UOB Lady Parser: Could not detect headers, using default positions');
        withdrawalsX = 344;
        depositsX = 435;
        balanceX = 517;
    }

    // Extract period
    const periodMatch = fullText.match(/Period:\s*(\d{2}\s+\w{3}\s+\d{4})\s+to\s+(\d{2}\s+\w{3}\s+\d{4})/);
    if (!periodMatch) throw new Error('Could not find statement period');

    const periodStart = parseUOBDate(periodMatch[1]);
    const periodEnd = parseUOBDate(periodMatch[2]);
    const currentYear = new Date(periodEnd).getFullYear();

    const transactions: ParsedStatement['transactions'] = [];
    let openingBalance = 0;
    let closingBalance = 0;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.text.trim();

        // Skip empty lines or non-transaction lines
        if (!text) continue;

        // Look for BALANCE B/F (opening balance)
        if (text.includes('BALANCE B/F')) {
            const numberItems = line.items.filter(item => /^[\d,]+\.\d{2}$/.test(item.str.trim()));
            if (numberItems.length > 0 && openingBalance === 0) {
                openingBalance = parseFloat(numberItems[numberItems.length - 1].str.replace(/,/g, ''));
                console.log(`UOB Lady Parser: Opening balance = ${openingBalance}`);
            }
            continue;
        }

        // Check for transaction date pattern (DD Mon)
        const dateMatch = text.match(/^(\d{2}\s+\w{3})\s+/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];

        // Find all number items in this line
        const numberItems = line.items.filter(item => /^-?[\d,]+\.\d{2}$/.test(item.str.trim()));

        if (numberItems.length === 0) continue;

        // Identify amounts based on X position
        let withdrawalAmount = 0;
        let depositAmount = 0;
        let balance = 0;

        for (const numItem of numberItems) {
            const x = numItem.x;
            const value = parseFloat(numItem.str.replace(/,/g, ''));

            // Calculate distance to each column
            const distToWithdrawal = Math.abs(x - withdrawalsX);
            const distToDeposit = Math.abs(x - depositsX);
            const distToBalance = Math.abs(x - balanceX);

            // Threshold for matching (column widths vary)
            const threshold = 80;

            if (distToBalance < threshold && distToBalance < distToWithdrawal && distToBalance < distToDeposit) {
                balance = value;
            } else if (distToWithdrawal < threshold && distToWithdrawal < distToDeposit) {
                withdrawalAmount = value;
            } else if (distToDeposit < threshold) {
                depositAmount = value;
            } else {
                // If nothing matches well, check if it's rightmost (likely balance)
                const maxX = Math.max(...numberItems.map(n => n.x));
                if (x === maxX) {
                    balance = value;
                }
            }
        }

        // Determine final amount (withdrawal is negative, deposit is positive)
        let amount = 0;
        if (withdrawalAmount > 0) {
            amount = -withdrawalAmount;
        } else if (depositAmount > 0) {
            amount = depositAmount;
        }

        // If we only have one number and it's the balance, skip (no transaction amount)
        if (amount === 0 && numberItems.length === 1) {
            continue;
        }

        // Extract description (everything between date and first number)
        const firstNumX = Math.min(...numberItems.map(n => n.x));
        const descItems = line.items.filter(item => {
            const itemX = item.x;
            return itemX >= 70 && itemX < firstNumX - 10 && item.str.trim() !== '';
        });
        let description = descItems.map(i => i.str).join(' ').replace(dateStr, '').trim();

        // Look ahead for continuation lines
        let j = i + 1;
        while (j < lines.length) {
            const nextLine = lines[j];
            const nextText = nextLine.text.trim();

            // Stop conditions
            if (/^\d{2}\s+\w{3}/.test(nextText) ||
                nextText.includes('BALANCE B/F') ||
                nextText.includes('End of Transaction') ||
                nextText.includes('Total') ||
                isFooterLine(nextText)) {
                break;
            }

            // Empty line or very short - might be end
            if (!nextText || nextText.length < 3) {
                j++;
                continue;
            }

            // Has numbers at the end - probably a new transaction
            if (/[\d,]+\.\d{2}\s*$/.test(nextText)) {
                break;
            }

            // Append continuation
            description += ' | ' + nextText;
            j++;
        }
        i = j - 1;

        if (balance > 0) {
            closingBalance = balance;
        }

        transactions.push({
            date: formatDate(dateStr, currentYear),
            description: description.trim(),
            amount,
            balance
        });
    }

    return {
        openingBalance,
        closingBalance,
        periodStart,
        periodEnd,
        currency: 'SGD',
        accountNumber: '',
        transactions
    };
}

function parseTextOnly(text: string): ParsedStatement {
    // Fallback text-only parsing (original logic)
    const periodMatch = text.match(/Period:\s*(\d{2}\s+\w{3}\s+\d{4})\s+to\s+(\d{2}\s+\w{3}\s+\d{4})/);
    if (!periodMatch) {
        throw new Error('Could not find statement period');
    }

    const periodStart = parseUOBDate(periodMatch[1]);
    const periodEnd = parseUOBDate(periodMatch[2]);

    const transactions: ParsedStatement['transactions'] = [];
    let openingBalance = 0;
    let closingBalance = 0;

    // Find the transaction section
    const transactionStart = text.indexOf('Description');
    let transactionEnd = text.indexOf('End of Transaction Details');

    if (transactionEnd === -1) {
        transactionEnd = text.indexOf('Total');
    }

    if (transactionStart === -1 || transactionEnd === -1) {
        throw new Error('Could not find transaction section');
    }

    const transactionSection = text.substring(transactionStart, transactionEnd);
    const transactionLines = transactionSection.split('\n');
    const currentYear = new Date(periodEnd).getFullYear();

    for (let i = 0; i < transactionLines.length; i++) {
        const line = transactionLines[i].trim();

        if (line.includes('BALANCE B/F')) {
            const balanceMatch = line.match(/([\d,]+\.\d{2})\s*$/);
            if (balanceMatch && openingBalance === 0) {
                openingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
            }
            continue;
        }

        const dateMatch = line.match(/^(\d{2}\s+\w{3})\s+(.+)/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        const restOfLine = dateMatch[2];

        // Extract numbers
        const numbers = restOfLine.match(/[\d,]+\.\d{2}/g);
        if (!numbers || numbers.length < 2) continue;

        const balance = parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));
        const amountVal = parseFloat(numbers[numbers.length - 2].replace(/,/g, ''));

        // Determine direction based on balance change
        const prevBalance = transactions.length > 0
            ? transactions[transactions.length - 1].balance
            : openingBalance;

        const amount = balance < prevBalance ? -amountVal : amountVal;

        // Extract description
        let description = restOfLine;
        for (const num of numbers) {
            description = description.replace(num, '');
        }
        description = description.trim();

        transactions.push({
            date: formatDate(dateStr, currentYear),
            description,
            amount,
            balance
        });

        closingBalance = balance;
    }

    return {
        openingBalance,
        closingBalance,
        periodStart,
        periodEnd,
        currency: 'SGD',
        accountNumber: '',
        transactions
    };
}

function parseUOBDate(dateStr: string): string {
    const months: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const parts = dateStr.trim().split(/\s+/);
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];
    const year = parts[2];

    return `${year}-${month}-${day}`;
}

function formatDate(dateStr: string, year: number): string {
    const months: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const parts = dateStr.trim().split(/\s+/);
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];

    return `${year}-${month}-${day}`;
}

function isFooterLine(line: string): boolean {
    const lowerLine = line.toLowerCase();

    const footerPatterns = [
        'please note that you are bound',
        'united overseas bank',
        'uob plaza',
        'co. reg. no',
        'gst reg. no',
        'www.uob.com',
        'page',
        '请注意',
        'check the entries',
        'notify us in writing',
        'shall be deemed valid',
        'conclusively binding',
        'raffles place',
        'claim against the bank',
        '80 raffles',
        'singapore 048624',
        'omissions or unauthorised',
        'errors, omissions',
        'fourteen (14) days',
        'entries above shall be',
        'in relation thereto',
        'duty under the rules',
        'foreign exchange',
        'deposit insurance',
    ];

    for (const pattern of footerPatterns) {
        if (lowerLine.includes(pattern)) return true;
    }

    // Exclude lines that are mostly non-ASCII
    const nonAsciiRatio = (line.match(/[^\x00-\x7F]/g) || []).length / line.length;
    if (nonAsciiRatio > 0.3 && line.length > 20) {
        return true;
    }

    return false;
}
