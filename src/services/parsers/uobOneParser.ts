/**
 * UOB Bank Statement Parser
 * Parses text extracted from UOB One account PDF statements
 */

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

export function parseUOBOneStatement(text: string): ParsedStatement {
    // Extract statement period
    const periodMatch = text.match(/Period:\s*(\d{2}\s+\w{3}\s+\d{4})\s+to\s+(\d{2}\s+\w{3}\s+\d{4})/);
    if (!periodMatch) {
        throw new Error('Could not find statement period');
    }

    const periodStart = parseUOBDate(periodMatch[1]);
    const periodEnd = parseUOBDate(periodMatch[2]);

    // Extract account number
    const accountMatch = text.match(/One Account\s+([\d-]+)/);
    const accountNumber = accountMatch ? accountMatch[1] : '';

    // Parse transactions
    const transactions: ParsedStatement['transactions'] = [];
    let openingBalance = 0;
    let closingBalance = 0;

    // Find the transaction section - stop at End of Transaction Details OR Currency Conversion (FX section)
    const transactionStart = text.indexOf('Account Transaction Details');
    let transactionEnd = text.indexOf('End of Transaction Details');

    // Also check for Currency Conversion section (FX Account) - stop before that
    const currencyConversionStart = text.indexOf('Currency Conversion');
    if (currencyConversionStart !== -1 && (transactionEnd === -1 || currencyConversionStart < transactionEnd)) {
        transactionEnd = currencyConversionStart;
    }

    if (transactionStart === -1 || transactionEnd === -1) {
        throw new Error('Could not find transaction section');
    }

    const transactionSection = text.substring(transactionStart, transactionEnd);
    const transactionLines = transactionSection.split('\n');

    const currentYear = new Date(periodEnd).getFullYear();

    for (let i = 0; i < transactionLines.length; i++) {
        const line = transactionLines[i].trim();

        // Look for BALANCE B/F (opening balance)
        if (line.includes('BALANCE B/F')) {
            const balanceMatch = line.match(/([\d,]+\.\d{2})\s*$/);
            if (balanceMatch && openingBalance === 0) {
                openingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
            }
            continue;
        }

        // Parse transaction lines - format: DD Mon Description ... Withdrawal Deposit Balance
        const dateMatch = line.match(/^(\d{2}\s+\w{3})\s+(.+)/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        let restOfLine = dateMatch[2];

        // Look ahead to collect continuation lines (lines that don't start with a date)
        // These are additional description lines like reference numbers, merchant names, etc.
        const continuationLines: string[] = [];
        let j = i + 1;
        while (j < transactionLines.length) {
            const nextLine = transactionLines[j].trim();
            // Stop if we hit another dated line or empty line
            if (!nextLine || /^\d{2}\s+\w{3}\s+/.test(nextLine) || nextLine.includes('BALANCE B/F')) {
                break;
            }
            // Skip lines that look like headers or footers
            if (nextLine.includes('End of Transaction') || nextLine.includes('Account Transaction')) {
                break;
            }
            // Skip footer/disclaimer patterns
            if (isFooterLine(nextLine)) {
                j++;
                continue;
            }
            continuationLines.push(nextLine);
            j++;
        }
        // Skip the continuation lines we've consumed
        i = j - 1;

        // Extract amounts from the end of the FIRST line (where amounts are)
        // Pattern: description ... withdrawal deposit balance
        const amountPattern = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
        const threeAmountMatch = restOfLine.match(amountPattern);

        if (threeAmountMatch) {
            // Has both withdrawal and deposit, or deposit and balance
            const parts = restOfLine.split(/\s+/);
            const numbers = parts.filter(p => /^[\d,]+\.\d{2}$/.test(p));

            if (numbers.length >= 2) {
                const balance = parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));
                let amount = 0;

                // Check if second-to-last is withdrawal or deposit
                const secondLast = parseFloat(numbers[numbers.length - 2].replace(/,/g, ''));

                // Extract description (everything before the numbers) from first line
                const descParts: string[] = [];
                for (const part of parts) {
                    if (/^[\d,]+\.\d{2}$/.test(part)) break;
                    descParts.push(part);
                }

                // Combine first line description with continuation lines
                let description = descParts.join(' ');
                if (continuationLines.length > 0) {
                    description += ' | ' + continuationLines.join(' | ');
                }

                // Determine if it's a withdrawal or deposit by checking balance change
                const prevBalance = transactions.length > 0
                    ? transactions[transactions.length - 1].balance
                    : openingBalance;

                if (balance < prevBalance) {
                    amount = -secondLast; // Withdrawal
                } else {
                    amount = secondLast; // Deposit
                }

                transactions.push({
                    date: formatDate(dateStr, currentYear),
                    description: description.trim(),
                    amount,
                    balance
                });

                closingBalance = balance;
            }
        } else {
            // Single amount at end (just balance, or amount + balance on same line)
            const singleAmountMatch = restOfLine.match(/([\d,]+\.\d{2})\s*$/);
            if (singleAmountMatch) {
                const lastNumber = parseFloat(singleAmountMatch[1].replace(/,/g, ''));

                // Check if there's another number before it
                const beforeLast = restOfLine.substring(0, singleAmountMatch.index);
                const prevAmountMatch = beforeLast.match(/([\d,]+\.\d{2})\s*$/);

                if (prevAmountMatch) {
                    // Two numbers: amount and balance
                    const amount_val = parseFloat(prevAmountMatch[1].replace(/,/g, ''));
                    const balance = lastNumber;

                    const prevBalance = transactions.length > 0
                        ? transactions[transactions.length - 1].balance
                        : openingBalance;

                    const amount = balance < prevBalance ? -amount_val : amount_val;

                    let description = beforeLast.substring(0, prevAmountMatch.index).trim();
                    if (continuationLines.length > 0) {
                        description += ' | ' + continuationLines.join(' | ');
                    }

                    transactions.push({
                        date: formatDate(dateStr, currentYear),
                        description,
                        amount,
                        balance
                    });

                    closingBalance = balance;
                }
            }
        }
    }

    // If we didn't capture closing balance from transactions, try to extract it
    if (closingBalance === 0) {
        const balanceMatch = text.match(/Balance\s+SGD\s*\n\s*([\d,]+\.\d{2})/);
        if (balanceMatch) {
            closingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
        }
    }

    return {
        openingBalance,
        closingBalance,
        periodStart,
        periodEnd,
        currency: 'SGD',
        accountNumber,
        transactions
    };
}

function parseUOBDate(dateStr: string): string {
    // Input: "01 Dec 2025"
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
    // Input: "01 Dec"
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

/**
 * Check if a line is a footer/disclaimer that should be excluded
 */
function isFooterLine(line: string): boolean {
    const lowerLine = line.toLowerCase();

    // Common footer patterns
    const footerPatterns = [
        'please note that you are bound',
        'united overseas bank',
        'uob plaza',
        'co. reg. no',
        'gst reg. no',
        'www.uob.com',
        'page \\d+ of \\d+',
        '请注意',  // Chinese disclaimer start
        '本行', // Chinese bank reference
        '户口', // Chinese account reference
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
        'governing the operation',
        // FX account headers and section dividers
        'currency conversion',
        'withdrawals deposits balance',
        'date description',
        'fx+',
        'sgd/jpy',
        'sgd/usd',
        'sgd/eur',
        'sgd/gbp',
        'sgd/aud',
        'sgd/nzd',
        'sgd/hkd',
        'sgd/cny',
        'nzd nzd nzd',
        'jpy jpy jpy',
        'usd usd usd',
        'eur eur eur',
        'total \\d',
    ];

    for (const pattern of footerPatterns) {
        if (pattern.includes('\\d')) {
            // Regex pattern
            if (new RegExp(pattern, 'i').test(line)) return true;
        } else {
            if (lowerLine.includes(pattern)) return true;
        }
    }

    // Exclude lines that are mostly non-ASCII (Chinese text in disclaimers)
    const nonAsciiRatio = (line.match(/[^\x00-\x7F]/g) || []).length / line.length;
    if (nonAsciiRatio > 0.3 && line.length > 20) {
        return true;
    }

    return false;
}
