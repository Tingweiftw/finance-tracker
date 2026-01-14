import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';
import type { Snapshot, Account } from '@/models';
import { formatCurrency, formatMonthYear } from '@/utils/date';

interface NetWorthChartProps {
    snapshots: Snapshot[];
    accounts: Account[];
}

interface ChartDataPoint {
    date: string;
    // Dynamic keys for account types (bank, credit, etc)
    [key: string]: number | string;
}

/**
 * Net worth stacked bar chart showing assets vs liabilities
 */
export function NetWorthChart({ snapshots, accounts }: NetWorthChartProps) {
    const accountTypeMap = useMemo(() => new Map(accounts.map(a => [a.id, a.type])), [accounts]);

    // Process snapshots into chart data
    const chartData = useMemo(() => {
        // 1. Group snapshots by Month -> AccountId -> Latest Snapshot
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

        const dataPoints: ChartDataPoint[] = [];

        // 2. Aggregate by Type for each month
        for (const [month, accountMap] of latestSnapshotsPerMonth) {
            const point: ChartDataPoint = { date: month };

            for (const [accountId, snapshot] of accountMap) {
                const type = accountTypeMap.get(accountId) || 'other';
                let balance = snapshot.balance;

                // If credit card, ensure it's negative (liability)
                // If it's already negative (from parsing), keep it. 
                // If positive (amount due), negate it.
                if (type === 'credit' && balance > 0) {
                    balance = -balance;
                }

                point[type] = ((point[type] as number) || 0) + balance;
            }
            dataPoints.push(point);
        }

        // Sort by date
        return dataPoints.sort((a, b) => a.date.localeCompare(b.date));
    }, [snapshots, accountTypeMap]);

    // Define bars to show based on what's in data or static list of types
    const assetTypes = [
        { id: 'bank', name: 'Cash', color: '#10b981' }, // Emerald
        { id: 'hysa', name: 'Savings', color: '#3b82f6' }, // Blue
        { id: 'brokerage', name: 'Investments', color: '#8b5cf6' }, // Violet
        { id: 'retirement', name: 'Retirement', color: '#f59e0b' }, // Amber
    ];

    // Liability
    const liabilityType = { id: 'credit', name: 'Debt', color: '#ef4444' }; // Red

    if (chartData.length === 0) {
        return (
            <div className="card">
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No data yet</div>
                    <div className="empty-state-text">Import statements to see your net worth chart</div>
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: 'var(--space-md)' }}>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }} stackOffset="sign">
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-bg-hover)"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="date"
                        stroke="var(--color-text-muted)"
                        tickFormatter={(value) => formatMonthYear(value + '-01')}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        stroke="var(--color-text-muted)"
                        tickFormatter={(value) => {
                            if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                            if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
                            return value.toString();
                        }}
                        tick={{ fontSize: 12 }}
                        width={50}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--color-bg-card)',
                            border: '1px solid var(--color-bg-hover)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)',
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                        cursor={{ fill: 'var(--color-bg-hover)', opacity: 0.4 }}
                        labelFormatter={(label) => formatMonthYear(label + '-01')}
                    />
                    <Legend wrapperStyle={{ color: 'var(--color-text-secondary)' }} />
                    <ReferenceLine y={0} stroke="var(--color-text-muted)" />

                    {/* Render Asset Bars */}
                    {assetTypes.map((type) => (
                        <Bar
                            key={type.id}
                            dataKey={type.id}
                            name={type.name}
                            stackId="a"
                            fill={type.color}
                            maxBarSize={50}
                        />
                    ))}

                    {/* Render Liability Bar */}
                    <Bar
                        key={liabilityType.id}
                        dataKey={liabilityType.id}
                        name={liabilityType.name}
                        stackId="a"
                        fill={liabilityType.color}
                        maxBarSize={50}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
