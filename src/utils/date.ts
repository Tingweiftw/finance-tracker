/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency = 'SGD'): string {
    return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

/**
 * Format a date as month/year
 */
export function formatMonthYear(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-SG', {
        month: 'short',
        year: 'numeric',
    }).format(date);
}

/**
 * Get the current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get the previous month in YYYY-MM format
 */
export function getPreviousMonth(monthStr?: string): string {
    const date = monthStr ? new Date(monthStr + '-01') : new Date();
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if a date is within the last N days
 */
export function isWithinDays(dateString: string, days: number): boolean {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
}

/**
 * Get the start of a month
 */
export function getMonthStart(dateString: string): string {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Get the end of a month
 */
export function getMonthEnd(dateString: string): string {
    const date = new Date(dateString);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
}
