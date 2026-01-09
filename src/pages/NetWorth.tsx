import { useState } from 'react';
import { NetWorthChart } from '@/components';
import type { Owner, Snapshot } from '@/models';

interface NetWorthPageProps {
    owners: Owner[];
    snapshots: Snapshot[];
}

export function NetWorth({ owners, snapshots }: NetWorthPageProps) {
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Net Worth</h1>
                    <p className="page-subtitle">Track your wealth over time</p>
                </div>

                {/* Owner filter */}
                {owners.length > 1 && (
                    <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto' }}>
                        <button
                            className={`btn ${selectedOwnerId === null ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedOwnerId(null)}
                        >
                            All
                        </button>
                        {owners.map((owner) => (
                            <button
                                key={owner.id}
                                className={`btn ${selectedOwnerId === owner.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedOwnerId(owner.id)}
                            >
                                {owner.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Chart */}
                <NetWorthChart
                    snapshots={snapshots}
                    owners={owners}
                    selectedOwnerId={selectedOwnerId}
                />

                {/* Summary stats */}
                {snapshots.length > 0 && (
                    <div className="card mt-lg">
                        <div className="card-title mb-md">Summary</div>
                        <NetWorthSummary
                            snapshots={snapshots}
                            selectedOwnerId={selectedOwnerId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

interface NetWorthSummaryProps {
    snapshots: Snapshot[];
    selectedOwnerId: string | null;
}

function NetWorthSummary({ snapshots, selectedOwnerId }: NetWorthSummaryProps) {
    // Filter by owner if selected
    const filtered = selectedOwnerId
        ? snapshots.filter((s) => s.ownerId === selectedOwnerId)
        : snapshots;

    // Group by month and get latest balance per account per month
    const monthlyTotals = new Map<string, number>();
    const accountMonthBalances = new Map<string, Map<string, number>>();

    for (const snapshot of filtered) {
        const month = snapshot.date.substring(0, 7);
        const key = `${snapshot.accountId}-${month}`;

        if (!accountMonthBalances.has(key)) {
            accountMonthBalances.set(key, new Map());
        }

        const accountMap = accountMonthBalances.get(key)!;
        const existing = accountMap.get(snapshot.date);
        if (!existing || snapshot.date > existing.toString()) {
            accountMap.set(month, snapshot.balance);
        }
    }

    // Calculate monthly totals
    for (const [key, balanceMap] of accountMonthBalances) {
        const month = key.split('-').slice(-2).join('-');
        for (const [, balance] of balanceMap) {
            monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + balance);
        }
    }

    const months = Array.from(monthlyTotals.keys()).sort();

    if (months.length < 2) {
        return <div className="text-secondary text-sm">Need more data for summary</div>;
    }

    const latestMonth = months[months.length - 1];
    const previousMonth = months[months.length - 2];
    const latestBalance = monthlyTotals.get(latestMonth) || 0;
    const previousBalance = monthlyTotals.get(previousMonth) || 0;
    const change = latestBalance - previousBalance;
    const changePercent = previousBalance !== 0
        ? ((change / previousBalance) * 100).toFixed(1)
        : '—';

    return (
        <div>
            <div className="flex justify-between mb-sm">
                <span className="text-secondary">Latest</span>
                <span className="font-semibold">
                    ${latestBalance.toLocaleString('en-SG', { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div className="flex justify-between mb-sm">
                <span className="text-secondary">Previous month</span>
                <span>
                    ${previousBalance.toLocaleString('en-SG', { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div className="flex justify-between">
                <span className="text-secondary">Change</span>
                <span className={change >= 0 ? 'text-income' : 'text-expense'}>
                    {change >= 0 ? '+' : ''}{change.toLocaleString('en-SG', { minimumFractionDigits: 2 })} ({changePercent}%)
                </span>
            </div>
        </div>
    );
}
