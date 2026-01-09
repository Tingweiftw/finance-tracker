import { useMemo } from 'react';
import type { Transaction } from '@/models';
import { formatCurrency, formatMonthYear } from '@/utils/date';

interface PassiveIncomeListProps {
    transactions: Transaction[];
}

interface MonthlyIncome {
    month: string;
    total: number;
    items: Transaction[];
}

/**
 * List of passive/investment income grouped by month
 */
export function PassiveIncomeList({ transactions }: PassiveIncomeListProps) {
    // Filter and group investment income by month
    const monthlyIncomes = useMemo(() => {
        const investmentTransactions = transactions.filter((t) => t.type === 'investment');

        // Group by month
        const monthMap = new Map<string, Transaction[]>();

        for (const t of investmentTransactions) {
            const month = t.date.substring(0, 7); // YYYY-MM
            if (!monthMap.has(month)) {
                monthMap.set(month, []);
            }
            monthMap.get(month)!.push(t);
        }

        // Convert to array and sort by month descending
        const result: MonthlyIncome[] = [];

        for (const [month, items] of monthMap) {
            result.push({
                month,
                total: items.reduce((sum, t) => sum + Math.abs(t.amount), 0),
                items: items.sort((a, b) => b.date.localeCompare(a.date)),
            });
        }

        return result.sort((a, b) => b.month.localeCompare(a.month));
    }, [transactions]);

    // Calculate total passive income
    const totalIncome = useMemo(() => {
        return monthlyIncomes.reduce((sum, m) => sum + m.total, 0);
    }, [monthlyIncomes]);

    if (monthlyIncomes.length === 0) {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No passive income yet</div>
                    <div className="empty-state-text">
                        Interest, dividends, and other investment income will appear here
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Summary card */}
            <div className="card card-gradient" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="card-header">
                    <span className="card-title">Total Passive Income</span>
                </div>
                <div className="card-value text-investment">{formatCurrency(totalIncome)}</div>
            </div>

            {/* Monthly breakdown */}
            <div className="list">
                {monthlyIncomes.map((monthData) => (
                    <div key={monthData.month} className="card" style={{ marginBottom: 'var(--space-sm)' }}>
                        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-sm)' }}>
                            <span className="font-semibold">{formatMonthYear(monthData.month + '-01')}</span>
                            <span className="text-investment font-semibold">
                                {formatCurrency(monthData.total)}
                            </span>
                        </div>

                        {monthData.items.map((item) => (
                            <div
                                key={item.id}
                                className="flex justify-between items-center"
                                style={{
                                    padding: 'var(--space-xs) 0',
                                    borderTop: '1px solid var(--color-bg-hover)',
                                }}
                            >
                                <div>
                                    <div className="text-sm truncate" style={{ maxWidth: '200px' }}>
                                        {item.description}
                                    </div>
                                    <div className="text-xs text-muted">{item.category}</div>
                                </div>
                                <span className="text-sm text-investment">
                                    {formatCurrency(Math.abs(item.amount))}
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
