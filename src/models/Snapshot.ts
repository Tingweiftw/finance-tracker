export interface Snapshot {
    date: string;
    accountId: string;
    balance: number;
    importId?: string;
}

export interface ImportRecord {
    id: string;
    date: string;
    fileName: string;
    accountId: string;
    transactionCount: number;
}
