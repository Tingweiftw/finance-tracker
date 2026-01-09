interface ParsedRow {
    date: string;
    description: string;
    amount: number;
    balance?: number;
}

interface CSVParseResult {
    rows: ParsedRow[];
    errors: string[];
}

/**
 * Parse a CSV file content into structured rows
 * Handles common bank statement formats
 */
export function parseCSV(content: string): CSVParseResult {
    const lines = content.trim().split('\n');
    const rows: ParsedRow[] = [];
    const errors: string[] = [];

    if (lines.length < 2) {
        return { rows: [], errors: ['CSV file is empty or has no data rows'] };
    }

    // Parse header to detect column positions
    const headerLine = lines[0].toLowerCase();
    const headers = parseCSVLine(headerLine);

    const columnMap = detectColumns(headers);

    if (columnMap.date === -1 || columnMap.description === -1 || columnMap.amount === -1) {
        errors.push('Could not detect required columns (date, description, amount)');
        return { rows, errors };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const columns = parseCSVLine(line);

            const date = parseDate(columns[columnMap.date]);
            const description = columns[columnMap.description]?.trim() || '';
            const amount = parseAmount(columns[columnMap.amount]);
            const balance = columnMap.balance !== -1
                ? parseAmount(columns[columnMap.balance])
                : undefined;

            if (date && description && !isNaN(amount)) {
                rows.push({ date, description, amount, balance });
            } else {
                errors.push(`Row ${i + 1}: Could not parse data`);
            }
        } catch {
            errors.push(`Row ${i + 1}: Parse error`);
        }
    }

    return { rows, errors };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * Detect column positions from header row
 */
function detectColumns(headers: string[]): { date: number; description: number; amount: number; balance: number } {
    const datePatterns = ['date', 'transaction date', 'posting date', 'value date'];
    const descPatterns = ['description', 'particulars', 'details', 'transaction description', 'narrative'];
    const amountPatterns = ['amount', 'transaction amount', 'debit', 'credit', 'withdrawal', 'deposit'];
    const balancePatterns = ['balance', 'running balance', 'available balance'];

    return {
        date: findColumnIndex(headers, datePatterns),
        description: findColumnIndex(headers, descPatterns),
        amount: findColumnIndex(headers, amountPatterns),
        balance: findColumnIndex(headers, balancePatterns),
    };
}

/**
 * Find column index matching any of the patterns
 */
function findColumnIndex(headers: string[], patterns: string[]): number {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();
        for (const pattern of patterns) {
            if (header.includes(pattern)) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Parse various date formats into YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    const cleaned = dateStr.trim().replace(/['"]/g, '');

    // Try common formats
    const formats = [
        // DD/MM/YYYY or DD-MM-YYYY
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{2})-(\d{2})$/,
        // DD MMM YYYY
        /^(\d{1,2})\s+(\w{3})\s+(\d{4})$/,
    ];

    for (const format of formats) {
        const match = cleaned.match(format);
        if (match) {
            if (format === formats[0]) {
                // DD/MM/YYYY
                const day = match[1].padStart(2, '0');
                const month = match[2].padStart(2, '0');
                const year = match[3];
                return `${year}-${month}-${day}`;
            } else if (format === formats[1]) {
                // Already YYYY-MM-DD
                return cleaned;
            } else if (format === formats[2]) {
                // DD MMM YYYY
                const day = match[1].padStart(2, '0');
                const monthName = match[2].toLowerCase();
                const year = match[3];
                const monthNum = monthNameToNumber(monthName);
                if (monthNum) {
                    return `${year}-${monthNum}-${day}`;
                }
            }
        }
    }

    // Try native Date parsing as fallback
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    return null;
}

/**
 * Convert month name to number
 */
function monthNameToNumber(name: string): string | null {
    const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04',
        may: '05', jun: '06', jul: '07', aug: '08',
        sep: '09', oct: '10', nov: '11', dec: '12',
    };
    return months[name.substring(0, 3).toLowerCase()] || null;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number {
    if (!amountStr) return NaN;

    // Remove currency symbols, spaces, and handle parentheses for negative
    let cleaned = amountStr
        .replace(/[^0-9.,\-()]/g, '')
        .replace(/,/g, '');

    // Handle (123.45) format for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        cleaned = '-' + cleaned.slice(1, -1);
    }

    return parseFloat(cleaned);
}

/**
 * Generate a hash for duplicate detection
 */
export function generateTransactionHash(date: string, description: string, amount: number): string {
    const str = `${date}|${description.toLowerCase().trim()}|${amount.toFixed(2)}`;
    // Simple hash - in production use a proper hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
