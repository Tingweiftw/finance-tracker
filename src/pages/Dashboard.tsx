import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BigExpenseList, ImportStatusCard } from '@/components';
import type { Owner, Account, Transaction, Snapshot } from '@/models';
import { formatCurrency, isWithinDays, getCurrentMonth } from '@/utils/date';
import { calculateThreshold, getBigExpenses, calculateMonthlyIncome } from '@/utils/thresholds';

interface DashboardProps {
    owners: Owner[];
    accounts: Account[];
    transactions: Transaction[];
    snapshots: Snapshot[];
    lastImportDates: Map<string, string>;
}

export function Dashboard({
    owners,
    accounts,
    transactions,
    snapshots,
    lastImportDates,
}: DashboardProps) {
    // Calculate current net worth from latest snapshots
    const netWorth = useMemo(() => {
        const latestByAccount = new Map<string, number>();

        for (const snapshot of snapshots) {
            const existing = latestByAccount.get(snapshot.accountId);
            if (!existing || snapshot.date > (snapshots.find((s) => s.balance === existing)?.date || '')) {
                latestByAccount.set(snapshot.accountId, snapshot.balance);
            }
        }

        let total = 0;
        for (const balance of latestByAccount.values()) {
            total += balance;
        }
        return total;
    }, [snapshots]);

    // Calculate big expenses from last 30 days
    const bigExpenses = useMemo(() => {
        const currentMonth = getCurrentMonth();
        const monthlyIncome = calculateMonthlyIncome(transactions, currentMonth);
        const threshold = calculateThreshold(monthlyIncome);

        const recentTransactions = transactions.filter((t) => isWithinDays(t.date, 30));
        return getBigExpenses(recentTransactions, threshold);
    }, [transactions]);

    // Calculate passive income this month
    const passiveIncomeThisMonth = useMemo(() => {
        const currentMonth = getCurrentMonth();
        return transactions
            .filter((t) => t.type === 'investment' && t.date.startsWith(currentMonth))
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    }, [transactions]);

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">
                        {owners.length > 0
                            ? `${owners.map((o) => o.name).join(' & ')}'s finances`
                            : 'Your financial overview'
                        }
                    </p>
                </div>

                {/* Net Worth Summary */}
                <div className="card card-gradient animate-slide-up" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="card-header">
                        <span className="card-title">Net Worth</span>
                        <Link to="/net-worth" className="section-link">View chart →</Link>
                    </div>
                    <div className="card-value">{formatCurrency(netWorth)}</div>
                    {passiveIncomeThisMonth > 0 && (
                        <div className="mt-sm text-sm text-investment">
                            +{formatCurrency(passiveIncomeThisMonth)} passive income this month
                        </div>
                    )}
                </div>

                {/* Import Status */}
                <section className="section">
                    <ImportStatusCard accounts={accounts} lastImportDates={lastImportDates} />
                </section>

                {/* Big Expenses */}
                <section className="section">
                    <div className="section-header">
                        <h2 className="section-title">Big Expenses</h2>
                        <Link to="/transactions" className="section-link">View all →</Link>
                    </div>
                    <BigExpenseList
                        expenses={bigExpenses.slice(0, 5)}
                    />
                </section>
            </div>
        </div>
    );
}
