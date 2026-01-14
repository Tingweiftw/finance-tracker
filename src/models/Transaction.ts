export type TransactionType = 'expense' | 'income' | 'investment' | 'transfer';

export interface Transaction {
    id: string;
    date: string;
    accountId: string;
    type: TransactionType;
    category: string;
    amount: number;
    description: string;
    tag?: string;
    importId?: string;
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
    expense: 'Expense',
    income: 'Income',
    investment: 'Investment',
    transfer: 'Transfer',
};

export const TRANSACTION_TYPE_ICONS: Record<TransactionType, string> = {
    expense: '💸',
    income: '💵',
    investment: '📊',
    transfer: '🔄',
};
