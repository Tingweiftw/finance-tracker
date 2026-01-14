/**
 * UOB Credit Card Statement Parser
 * Parses PDF statements that may contain multiple credit cards
 * 
 * Key features:
 * - Detects multiple card sections (UOB ONE CARD, LADY'S CARD, etc.)
 * - Tags transactions with card name
 * - Skips PREVIOUS BALANCE and payment lines (already tracked in bank statements)
 * - All transactions are expenses (negative amounts)
 */

import type { ParserInput } from './index';
import type { PDFLine } from '@/utils/pdfExtractor';

export interface CreditCardTransaction {
    date: string;      // YYYY-MM-DD (uses Trans Date, not Post Date)
    description: string;
    amount: number;    // Always negative (expense)
    cardName: string;  // e.g., "UOB ONE CARD", "LADY'S CARD"
    foreignAmount?: string;  // e.g., "MYR 15.85"
}

export interface CreditCardStatement {
    statementDate: string;  // YYYY-MM-DD
    dueDate: string;        // YYYY-MM-DD
    totalAmount: number;
    cards: {
        cardName: string;
        cardNumber: string;
        cardHolder: string;
        balance: number;
    }[];
    transactions: CreditCardTransaction[];
}

// Also export in ParsedStatement format for compatibility with existing import flow
export interface ParsedStatement {
    openingBalance: number;
    closingBalance: number;
    periodStart: string;
    periodEnd: string;
    currency: string;
    accountNumber: string;
    transactions: {
        date: string;
        description: string;
        amount: number;
        balance: number;
        tag?: string;  // Card name for credit cards
    }[];
}

// Card name patterns to detect section headers
const CARD_PATTERNS = [
    /^UOB ONE CARD$/i,
    /^LADY'S CARD$/i,
    /^UOB PRIVI MILES CARD$/i,
    /^UOB VISA SIGNATURE CARD$/i,
    /^UOB PRVI MILES CARD$/i,
    /^UOB ABSOLUTE CASHBACK CARD$/i,
    /^KrisFlyer UOB.*$/i,
];

// Lines to skip (payments and balance lines - already tracked in bank statements)
const SKIP_PATTERNS = [
    /^PREVIOUS BALANCE$/i,
    /^PAYMT THRU E-BANK/i,
    /^PAYMENT.*RECEIVED/i,
    /^CREDIT ADJUSTMENT/i,
    /^SUB TOTAL$/i,
    /^TOTAL BALANCE FOR/i,
];

/**
 * Parse UOB credit card statement
 */
export function parseUOBCreditCardStatement(input: ParserInput): ParsedStatement {
    if (input.lines && input.lines.length > 0) {
        return parseWithLayout(input.lines, input.text);
    }
    return parseTextOnly(input.text);
}

function parseWithLayout(lines: PDFLine[], fullText: string): ParsedStatement {
    const transactions: ParsedStatement['transactions'] = [];
    let currentCardName = '';
    let statementDate = '';

    // Extract statement date from header
    const stmtDateMatch = fullText.match(/Statement Date\s+(\d{1,2}\s+\w{3}\s+\d{4})/i);
    if (stmtDateMatch) {
        statementDate = parseUOBDate(stmtDateMatch[1]);
    }

    // Parse year from statement date for transaction dates
    const currentYear = statementDate ? new Date(statementDate).getFullYear() : new Date().getFullYear();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.text.trim();

        if (!text) continue;

        // Check for card section header
        const cardMatch = detectCardHeader(text);
        if (cardMatch) {
            currentCardName = cardMatch;
            // Look for card number on next line (skip it)
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].text.trim();
                const cardNumMatch = nextLine.match(/^(\d{4}-\d{4}-\d{4}-\d{4})\s+/);
                if (cardNumMatch) {
                    i++; // Skip the card number line
                }
            }
            continue;
        }

        // Skip lines we don't want
        if (shouldSkipLine(text)) {
            continue;
        }

        // Check for foreign currency line (comes after transaction)
        const foreignMatch = text.match(/^([A-Z]{3})\s+([\d,.]+)$/);
        if (foreignMatch && transactions.length > 0) {
            // Attach to previous transaction
            const lastTx = transactions[transactions.length - 1];
            lastTx.description += ` (${foreignMatch[1]} ${foreignMatch[2]})`;
            continue;
        }

        // Check for Ref No. line (skip but could attach to previous tx if needed)
        if (text.startsWith('Ref No.')) {
            continue;
        }

        // Parse transaction line
        // Format: DD Mon | DD Mon | Description | Amount
        // e.g., "01 DEC  30 NOV  GIANT-KIM KEAT Singapore  3.85"
        const txMatch = text.match(/^(\d{2}\s+\w{3})\s+(\d{2}\s+\w{3})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+CR)?$/);
        if (txMatch && currentCardName) {
            const transDate = txMatch[2];
            const description = txMatch[3].trim();
            const amountStr = txMatch[4];
            const isCreditRefund = text.endsWith(' CR');

            // Parse amount
            let amount = parseFloat(amountStr.replace(/,/g, ''));

            // Credit card expenses are negative, refunds/credits are positive
            if (!isCreditRefund) {
                amount = -Math.abs(amount);
            }

            transactions.push({
                date: parseStatementDate(transDate, currentYear),
                description,
                amount,
                balance: 0, // Credit cards don't have running balance per tx
                tag: currentCardName,
            });
            continue;
        }

        // Alternative parsing using PDF item positions
        // Sometimes the text join is not perfect, try positional parsing
        const dateMatch = text.match(/^(\d{2}\s+\w{3})/);
        if (dateMatch && currentCardName) {
            // Check if this looks like a transaction line with amount
            const numberItems = line.items.filter(item => /^[\d,]+\.\d{2}$/.test(item.str.trim()));

            if (numberItems.length > 0) {
                // Get the last number as amount
                const amountItem = numberItems[numberItems.length - 1];
                const amount = parseFloat(amountItem.str.replace(/,/g, ''));

                // Check for CR suffix
                const isCreditRefund = line.items.some(item => item.str.trim() === 'CR');

                // Get description (items between dates and amount)
                const descItems = line.items.filter(item => {
                    const str = item.str.trim();
                    // Skip date patterns and amounts
                    if (/^\d{2}\s+\w{3}$/.test(str)) return false;
                    if (/^[\d,]+\.\d{2}$/.test(str)) return false;
                    if (str === 'CR') return false;
                    return str.length > 0;
                });

                // Try to find trans date (second date in line)
                const dateItems = line.items.filter(item => /^\d{2}\s+\w{3}$/.test(item.str.trim()));
                const transDate = dateItems.length >= 2 ? dateItems[1].str.trim() : dateItems[0].str.trim();

                const description = descItems.map(i => i.str).join(' ').trim();

                if (description && !shouldSkipLine(description)) {
                    transactions.push({
                        date: parseStatementDate(transDate, currentYear),
                        description,
                        amount: isCreditRefund ? Math.abs(amount) : -Math.abs(amount),
                        balance: 0,
                        tag: currentCardName,
                    });
                }
            }
        }
    }

    // Deduplicate transactions (sometimes both parsing methods catch the same tx)
    const seen = new Set<string>();
    const uniqueTransactions = transactions.filter(tx => {
        const key = `${tx.date}|${tx.description}|${tx.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return {
        openingBalance: 0,
        closingBalance: 0, // No balance tracking for credit cards
        periodStart: statementDate,
        periodEnd: statementDate,
        currency: 'SGD',
        accountNumber: '',
        transactions: uniqueTransactions,
    };
}

function parseTextOnly(text: string): ParsedStatement {
    // Fallback text-only parser
    const transactions: ParsedStatement['transactions'] = [];
    const lines = text.split('\n');

    let currentCardName = '';
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check for card header
        const cardMatch = detectCardHeader(line);
        if (cardMatch) {
            currentCardName = cardMatch;
            continue;
        }

        // Skip unwanted lines
        if (shouldSkipLine(line)) continue;

        // Parse transaction
        const txMatch = line.match(/^(\d{2}\s+\w{3})\s+(\d{2}\s+\w{3})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+CR)?$/);
        if (txMatch && currentCardName) {
            const transDate = txMatch[2];
            const description = txMatch[3].trim();
            const amountStr = txMatch[4];
            const isCreditRefund = line.endsWith(' CR');

            let amount = parseFloat(amountStr.replace(/,/g, ''));
            if (!isCreditRefund) {
                amount = -Math.abs(amount);
            }

            transactions.push({
                date: parseStatementDate(transDate, currentYear),
                description,
                amount,
                balance: 0,
                tag: currentCardName,
            });
        }
    }

    return {
        openingBalance: 0,
        closingBalance: 0,
        periodStart: '',
        periodEnd: '',
        currency: 'SGD',
        accountNumber: '',
        transactions,
    };
}

/**
 * Detect if a line is a card section header
 */
function detectCardHeader(text: string): string | null {
    const trimmed = text.trim();
    for (const pattern of CARD_PATTERNS) {
        if (pattern.test(trimmed)) {
            return trimmed;
        }
    }
    return null;
}

/**
 * Check if a line should be skipped
 */
function shouldSkipLine(text: string): boolean {
    const trimmed = text.trim();
    for (const pattern of SKIP_PATTERNS) {
        if (pattern.test(trimmed)) {
            return true;
        }
    }

    // Skip footer lines
    if (trimmed.includes('United Overseas Bank') ||
        trimmed.includes('请注意') ||
        trimmed.includes('Please note that you are bound') ||
        trimmed.includes('Page ') && trimmed.includes(' of ')) {
        return true;
    }

    return false;
}

/**
 * Parse UOB date format: "01 Dec 2025" -> "2025-12-01"
 */
function parseUOBDate(dateStr: string): string {
    const months: { [key: string]: string } = {
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
    const year = parts[2];

    return `${year}-${month}-${day}`;
}

/**
 * Parse statement date without year: "01 Dec" -> "2025-12-01"
 */
function parseStatementDate(dateStr: string, year: number): string {
    const months: { [key: string]: string } = {
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
