/**
 * Basic PDF text extraction
 * Note: For complex bank statements, CSV import is recommended
 * 
 * This implementation provides basic text extraction.
 * For production use, consider using pdf.js or a server-side solution.
 */

interface PDFParseResult {
    text: string;
    error?: string;
}

/**
 * Extract text from a PDF file
 * This is a placeholder - real PDF parsing requires pdf.js or similar
 */
export async function parsePDF(file: File): Promise<PDFParseResult> {
    // Check file type
    if (file.type !== 'application/pdf') {
        return { text: '', error: 'File is not a PDF' };
    }

    // For now, return a message indicating PDF support is limited
    // In production, you would use pdf.js here
    return {
        text: '',
        error: 'PDF parsing is limited. Please export your bank statement as CSV for better results.',
    };
}

/**
 * Try to extract transactions from PDF text
 * This is a best-effort parser for common statement formats
 */
export function extractTransactionsFromText(text: string): {
    date: string;
    description: string;
    amount: number;
}[] {
    const transactions: { date: string; description: string; amount: number }[] = [];

    // Common patterns for bank statement lines
    // DD/MM/YYYY Description Amount
    const linePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\-\d,.]+)\s*$/gm;

    let match;
    while ((match = linePattern.exec(text)) !== null) {
        const [, dateStr, description, amountStr] = match;

        // Parse date
        const dateParts = dateStr.split(/[\/\-]/);
        if (dateParts.length === 3) {
            let year = dateParts[2];
            if (year.length === 2) {
                year = '20' + year;
            }
            const date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

            // Parse amount
            const amount = parseFloat(amountStr.replace(/,/g, ''));

            if (!isNaN(amount) && description.trim()) {
                transactions.push({
                    date,
                    description: description.trim(),
                    amount,
                });
            }
        }
    }

    return transactions;
}
