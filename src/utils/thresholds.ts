import type { Transaction } from '@/models';

// Default threshold: 5% of monthly income
const DEFAULT_THRESHOLD_PERCENTAGE = 0.05;

// Fallback threshold if no income data available
const DEFAULT_FALLBACK_THRESHOLD = 500;

/**
 * Calculate the big expense threshold based on monthly income
 */
export function calculateThreshold(monthlyIncome: number): number {
    if (monthlyIncome <= 0) {
        return DEFAULT_FALLBACK_THRESHOLD;
    }
    return monthlyIncome * DEFAULT_THRESHOLD_PERCENTAGE;
}

/**
 * Check if a transaction qualifies as a big expense
 */
export function isBigExpense(transaction: Transaction, threshold: number): boolean {
    return (
        transaction.type === 'expense' &&
        Math.abs(transaction.amount) >= threshold
    );
}

/**
 * Filter transactions to get only big expenses
 */
export function getBigExpenses(
    transactions: Transaction[],
    threshold: number
): Transaction[] {
    return transactions.filter((t) => isBigExpense(t, threshold));
}

/**
 * Calculate monthly income from transactions
 */
export function calculateMonthlyIncome(
    transactions: Transaction[],
    month: string
): number {
    return transactions
        .filter((t) => t.type === 'income' && t.date.startsWith(month))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}
