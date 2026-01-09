/**
 * Google Sheets service for data persistence
 * 
 * This implementation uses a simple approach:
 * 1. Data is stored in separate sheets: Owners, Accounts, Transactions, Snapshots
 * 2. Each sheet has headers in the first row
 * 3. Append-only pattern for transactions
 * 
 * To use this service, you need to:
 * 1. Create a Google Cloud project
 * 2. Enable the Google Sheets API
 * 3. Create credentials (API key or OAuth)
 * 4. Share your spreadsheet with the service account (if using service account)
 */

import type { Owner, Account, Transaction, Snapshot } from '@/models';

// Configuration - replace with your values
const SHEETS_CONFIG = {
    apiKey: import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '',
    spreadsheetId: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '',
    sheets: {
        owners: 'Owners',
        accounts: 'Accounts',
        transactions: 'Transactions',
        snapshots: 'Snapshots',
    },
};

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Check if Sheets is configured
 */
export function isSheetsConfigured(): boolean {
    return Boolean(SHEETS_CONFIG.apiKey && SHEETS_CONFIG.spreadsheetId);
}

/**
 * Generic function to read a range from a sheet
 */
async function readRange<T>(sheetName: string, parseRow: (row: string[]) => T): Promise<T[]> {
    if (!isSheetsConfigured()) {
        console.warn('Google Sheets not configured');
        return [];
    }

    const range = `${sheetName}!A2:Z`;
    const url = `${SHEETS_API_BASE}/${SHEETS_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}?key=${SHEETS_CONFIG.apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];
        return rows.map(parseRow);
    } catch (error) {
        console.error('Failed to read from Sheets:', error);
        return [];
    }
}

/**
 * Generic function to append rows to a sheet
 */
async function appendRows(sheetName: string, values: (string | number)[][]): Promise<boolean> {
    if (!isSheetsConfigured()) {
        console.warn('Google Sheets not configured');
        return false;
    }

    const range = `${sheetName}!A:Z`;
    const url = `${SHEETS_API_BASE}/${SHEETS_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&key=${SHEETS_CONFIG.apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values }),
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Failed to append to Sheets:', error);
        return false;
    }
}

// ===== Owners =====

const parseOwnerRow = (row: string[]): Owner => ({
    id: row[0],
    name: row[1],
});

export async function getOwners(): Promise<Owner[]> {
    return readRange(SHEETS_CONFIG.sheets.owners, parseOwnerRow);
}

export async function addOwner(owner: Owner): Promise<boolean> {
    return appendRows(SHEETS_CONFIG.sheets.owners, [[owner.id, owner.name]]);
}

// ===== Accounts =====

const parseAccountRow = (row: string[]): Account => ({
    id: row[0],
    ownerId: row[1],
    institution: row[2],
    name: row[3],
    type: row[4] as Account['type'],
});

export async function getAccounts(): Promise<Account[]> {
    return readRange(SHEETS_CONFIG.sheets.accounts, parseAccountRow);
}

export async function addAccount(account: Account): Promise<boolean> {
    return appendRows(SHEETS_CONFIG.sheets.accounts, [
        [account.id, account.ownerId, account.institution, account.name, account.type],
    ]);
}

// ===== Transactions =====

const parseTransactionRow = (row: string[]): Transaction => ({
    id: row[0],
    date: row[1],
    ownerId: row[2],
    accountId: row[3],
    type: row[4] as Transaction['type'],
    category: row[5],
    amount: parseFloat(row[6]),
    description: row[7],
    tag: row[8] || undefined,
});

export async function getTransactions(): Promise<Transaction[]> {
    return readRange(SHEETS_CONFIG.sheets.transactions, parseTransactionRow);
}

export async function addTransactions(transactions: Transaction[]): Promise<boolean> {
    const values = transactions.map((t) => [
        t.id,
        t.date,
        t.ownerId,
        t.accountId,
        t.type,
        t.category,
        t.amount,
        t.description,
        t.tag || '',
    ]);
    return appendRows(SHEETS_CONFIG.sheets.transactions, values);
}

// ===== Snapshots =====

const parseSnapshotRow = (row: string[]): Snapshot => ({
    date: row[0],
    ownerId: row[1],
    accountId: row[2],
    balance: parseFloat(row[3]),
});

export async function getSnapshots(): Promise<Snapshot[]> {
    return readRange(SHEETS_CONFIG.sheets.snapshots, parseSnapshotRow);
}

export async function addSnapshot(snapshot: Snapshot): Promise<boolean> {
    return appendRows(SHEETS_CONFIG.sheets.snapshots, [
        [snapshot.date, snapshot.ownerId, snapshot.accountId, snapshot.balance],
    ]);
}

// ===== Utility functions =====

/**
 * Get the last import date for each account
 */
export async function getLastImportDates(): Promise<Map<string, string>> {
    const transactions = await getTransactions();
    const lastDates = new Map<string, string>();

    for (const t of transactions) {
        const current = lastDates.get(t.accountId);
        if (!current || t.date > current) {
            lastDates.set(t.accountId, t.date);
        }
    }

    return lastDates;
}
