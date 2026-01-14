import { NetWorthChart } from '@/components';
import type { Snapshot, Account } from '@/models';

interface NetWorthPageProps {
    snapshots: Snapshot[];
    accounts: Account[];
}

export function NetWorth({ snapshots, accounts }: NetWorthPageProps) {

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Net Worth</h1>
                    <p className="page-subtitle">Track your wealth over time</p>
                </div>


                {/* Chart */}
                <NetWorthChart
                    snapshots={snapshots}
                    accounts={accounts}
                />

                {/* Summary stats */}
                {snapshots.length > 0 && (
                    <div className="card mt-lg">
                        <div className="card-title mb-md">Summary</div>
                        <NetWorthSummary
                            snapshots={snapshots}
                            accounts={accounts}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function NetWorthSummary({ snapshots, accounts }: { snapshots: Snapshot[], accounts: Account[] }) {
    // Helper to get account type
    const accountTypeMap = new Map(accounts.map(a => [a.id, a.type]));

    const monthlyTotals = new Map<string, number>();

    // 1. Organize snapshots by Month -> AccountId -> Latest Snapshot
    const latestSnapshotsPerMonth = new Map<string, Map<string, Snapshot>>();

    for (const s of snapshots) {
        const month = s.date.substring(0, 7);
        if (!latestSnapshotsPerMonth.has(month)) {
            latestSnapshotsPerMonth.set(month, new Map());
        }
        const accountMap = latestSnapshotsPerMonth.get(month)!;

        const existing = accountMap.get(s.accountId);
        if (!existing || s.date > existing.date) {
            accountMap.set(s.accountId, s);
        }
    }

    // 2. Sum up totals
    for (const [month, accountMap] of latestSnapshotsPerMonth) {
        let total = 0;
        for (const [accountId, snapshot] of accountMap) {
            const type = accountTypeMap.get(accountId);
            let balance = snapshot.balance;

            // If it's a credit card, treat positive balance as liability (negative net worth)
            if (type === 'credit' && balance > 0) {
                balance = -balance;
            }

            total += balance;
        }
        monthlyTotals.set(month, total);
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
