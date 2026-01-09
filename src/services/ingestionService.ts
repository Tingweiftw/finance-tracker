import { parseCSV, generateTransactionHash } from '@/utils/csvParser';
import { processTransaction } from './classificationService';
import type { Transaction, Account } from '@/models';

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
    ownerId: string,
    account: Account,
    existingHashes: Set<string>
): Promise<ImportResult> {
    const content = await file.text();
    const { rows, errors } = parseCSV(content);

    const transactions: Transaction[] = [];
    let duplicates = 0;

    for (const row of rows) {
        // Generate hash for duplicate detection
        const hash = generateTransactionHash(row.date, row.description, row.amount);

        if (existingHashes.has(hash)) {
            duplicates++;
            continue;
        }

        // Process and classify transaction
        const transaction = processTransaction(
            `${account.id}-${hash}`,
            row.date,
            row.description,
            row.amount,
            ownerId,
            account.id,
            account.type
        );

        transactions.push(transaction);
        existingHashes.add(hash);
    }

    return { transactions, duplicates, errors };
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
