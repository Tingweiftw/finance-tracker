/**
 * Google Sheets service for data persistence
 * 
 * This implementation uses a simple approach:
 * 1. Data is stored in separate sheets: Accounts, Transactions, Snapshots
 * 2. Each sheet has headers in the first row
 * 3. Append-only pattern for transactions
 * 
 * To use this service, you need to:
 * 1. Create a Google Cloud project
 * 2. Enable the Google Sheets API
 * 3. Create credentials (API key or OAuth)
 * 4. Share your spreadsheet with the service account (if using service account)
 */

import type { Account, Transaction, Snapshot } from '@/models';

import { KJUR } from 'jsrsasign';

// Configuration - replace with your values
const SHEETS_CONFIG = {
    // Expects the JSON content of the service account key
    serviceAccountJson: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '',
    spreadsheetId: import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '',
    sheets: {
        accounts: 'Accounts',
        transactions: 'Transactions',
        snapshots: 'Snapshots',
    },
};

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Check if Sheets is configured
 */
export function isSheetsConfigured(): boolean {
    const isConfigured = Boolean(SHEETS_CONFIG.serviceAccountJson && SHEETS_CONFIG.spreadsheetId);
    if (!isConfigured) {
        console.warn('Sheets Service: Missing configuration', {
            hasJson: !!SHEETS_CONFIG.serviceAccountJson,
            hasId: !!SHEETS_CONFIG.spreadsheetId
        });
    }
    return isConfigured;
}

/**
 * Generate Access Token from Service Account JSON
 */
async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        let credentials;
        try {
            credentials = JSON.parse(SHEETS_CONFIG.serviceAccountJson);
        } catch (e) {
            console.error('Failed to parse VITE_GOOGLE_SERVICE_ACCOUNT_KEY. Ensure it contains the JSON content, not a path.');
            console.error('Received value (first 50 chars):', SHEETS_CONFIG.serviceAccountJson.substring(0, 50) + '...');
            throw new Error('Invalid Service Account Configuration');
        }

        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'RS256', typ: 'JWT' };
        const payload = {
            iss: credentials.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: TOKEN_ENDPOINT,
            exp: now + 3600,
            iat: now,
        };

        const signedJWT = KJUR.jws.JWS.sign(
            'RS256',
            JSON.stringify(header),
            JSON.stringify(payload),
            credentials.private_key
        );

        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: signedJWT,
            }),
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Buffer of 1 minute

        return cachedToken!;
        return cachedToken!;
    } catch (error) {
        console.error('Sheets Service: Auth Error:', error);
        throw error;
    }
}

/**
 * Generic function to read a range from a sheet
 */
async function readRange<T>(sheetName: string, parseRow: (row: string[]) => T): Promise<T[]> {
    if (!isSheetsConfigured()) return [];

    try {
        const token = await getAccessToken();
        const range = `${sheetName}!A2:Z`;
        const url = `${SHEETS_API_BASE}/${SHEETS_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];
        console.log(`Sheets Service: Read ${rows.length} rows from ${sheetName}`);
        return rows.map(parseRow);
    } catch (error) {
        console.error(`Sheets Service: Failed to read from ${sheetName}:`, error);
        return [];
    }
}

/**
 * Generic function to append rows to a sheet
 */
async function appendRows(sheetName: string, values: (string | number)[][]): Promise<boolean> {
    if (!isSheetsConfigured()) return false;

    try {
        const token = await getAccessToken();
        const range = `${sheetName}!A:Z`;
        const url = `${SHEETS_API_BASE}/${SHEETS_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ values }),
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error(`Sheets Service: Failed to append to ${sheetName}:`, error);
        return false;
    }
}

// ===== Accounts =====

const parseAccountRow = (row: string[]): Account => ({
    id: row[0],
    institution: row[1],
    name: row[2],
    type: row[3] as Account['type'],
});

export async function getAccounts(): Promise<Account[]> {
    return readRange(SHEETS_CONFIG.sheets.accounts, parseAccountRow);
}

export async function addAccount(account: Account): Promise<boolean> {
    return appendRows(SHEETS_CONFIG.sheets.accounts, [
        [account.id, account.institution, account.name, account.type],
    ]);
}

// ===== Transactions =====

const parseTransactionRow = (row: string[]): Transaction => ({
    id: row[0],
    date: row[1],
    accountId: row[2],
    type: row[3] as Transaction['type'],
    category: row[4],
    amount: parseFloat(row[5]),
    description: row[6],
    tag: row[7] || undefined,
});

export async function getTransactions(): Promise<Transaction[]> {
    return readRange(SHEETS_CONFIG.sheets.transactions, parseTransactionRow);
}

export async function addTransactions(transactions: Transaction[]): Promise<boolean> {
    const values = transactions.map((t) => [
        t.id,
        t.date,
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
    accountId: row[1],
    balance: parseFloat(row[2]),
});

export async function getSnapshots(): Promise<Snapshot[]> {
    return readRange(SHEETS_CONFIG.sheets.snapshots, parseSnapshotRow);
}

export async function addSnapshot(snapshot: Snapshot): Promise<boolean> {
    return appendRows(SHEETS_CONFIG.sheets.snapshots, [
        [snapshot.date, snapshot.accountId, snapshot.balance],
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
