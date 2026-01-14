import { processTransaction } from './classificationService';
import { getParser } from './parsers';
import type { Transaction, Account } from '@/models';
import { parseCSV, generateTransactionHash } from '@/utils/csvParser';

interface ImportResult {
    transactions: Transaction[];
    duplicates: number;
    errors: string[];
}

/**
 * Import transactions from a CSV file
 */
export async function importCSV(
    file: File,
    account: Account,
    existingHashes: Set<string>
): Promise<ImportResult> {
    const content = await file.text();
    const { rows, errors } = parseCSV(content);

    const transactions: Transaction[] = [];
    let duplicates = 0;

    for (const row of rows) {
        const hash = generateTransactionHash(row.date, row.description, row.amount);

        if (existingHashes.has(hash)) {
            duplicates++;
            continue;
        }

        const transaction = processTransaction(
            `${account.id}-${hash}`,
            row.date,
            row.description,
            row.amount,
            account.id,
            account.type
        );

        transactions.push(transaction);
        existingHashes.add(hash);
    }

    return { transactions, duplicates, errors };
}

/**
 * Import transactions from a UOB PDF statement text
 */
export async function importUOBStatement(
    text: string,
    account: Account,
    existingHashes: Set<string>
): Promise<ImportResult> {
    const parser = getParser(account);
    const parsed = parser(text);
    const transactions: Transaction[] = [];
    let duplicates = 0;

    for (const t of parsed.transactions) {
        // Use the same hashing logic as CSV for consistency
        const hash = generateTransactionHash(t.date, t.description, t.amount);

        if (existingHashes.has(hash)) {
            duplicates++;
            // The original instruction included a block here that referenced `file.type`.
            // However, `importUOBStatement` does not receive a `file` parameter.
            // Assuming the intent was to add a specific check or throw an error
            // related to PDF processing within this function, but without the `file` context,
            // the provided `if (file.type === 'application/pdf')` condition cannot be applied directly.
            // For now, the original `continue` is kept to maintain functionality.
            // If a specific error condition for PDF duplicates is needed here,
            // it would require re-evaluating the context or adding a `file` parameter.
            continue;
        }

        const transaction = processTransaction(
            `${account.id}-${hash}`,
            t.date,
            t.description,
            t.amount,
            account.id,
            account.type
        );

        transactions.push(transaction);
        existingHashes.add(hash);
    }

    return { transactions, duplicates, errors: [] };
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Validate file type
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
    const validTypes = ['text/csv', 'application/pdf'];
    const validExtensions = ['.csv', '.pdf'];

    // Check MIME type
    if (validTypes.includes(file.type)) {
        return { valid: true };
    }

    // Check extension as fallback
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (validExtensions.includes(ext)) {
        return { valid: true };
    }

    return {
        valid: false,
        error: 'Please upload a CSV or PDF file',
    };
}
