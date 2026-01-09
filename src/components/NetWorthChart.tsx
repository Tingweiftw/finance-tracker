import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { Snapshot, Owner } from '@/models';
import { formatCurrency, formatMonthYear } from '@/utils/date';

interface NetWorthChartProps {
    snapshots: Snapshot[];
    owners: Owner[];
    selectedOwnerId?: string | null;
}

interface ChartDataPoint {
    date: string;
    [key: string]: number | string;
}

// Colors for different owners - WARM palette
const OWNER_COLORS = ['#f59e0b', '#10b981', '#f97316', '#a3e635'];

/**
 * Net worth line chart showing balance trends over time
 */
export function NetWorthChart({ snapshots, owners, selectedOwnerId }: NetWorthChartProps) {
    // Process snapshots into chart data
    const chartData = useMemo(() => {
        // Group snapshots by date
        const dateMap = new Map<string, ChartDataPoint>();

        // Filter snapshots by owner if selected
        const filteredSnapshots = selectedOwnerId
            ? snapshots.filter((s) => s.ownerId === selectedOwnerId)
            : snapshots;

        for (const snapshot of filteredSnapshots) {
            // Use month as the date key for grouping
            const monthKey = snapshot.date.substring(0, 7); // YYYY-MM

            if (!dateMap.has(monthKey)) {
                dateMap.set(monthKey, { date: monthKey });
            }

            const point = dateMap.get(monthKey)!;

            // Add to owner's total
            const ownerKey = snapshot.ownerId;
            point[ownerKey] = ((point[ownerKey] as number) || 0) + snapshot.balance;

            // Add to combined total
            point['combined'] = ((point['combined'] as number) || 0) + snapshot.balance;
        }

        // Sort by date and convert to array
        return Array.from(dateMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );
    }, [snapshots, selectedOwnerId]);

    // Determine which lines to show
    const linesToShow = useMemo(() => {
        if (selectedOwnerId) {
            const owner = owners.find((o) => o.id === selectedOwnerId);
            return [{ id: selectedOwnerId, name: owner?.name || 'Selected', color: OWNER_COLORS[0] }];
        }

        // Show combined + all owners
        return [
            { id: 'combined', name: 'Combined', color: '#ffffff' },
            ...owners.map((owner, i) => ({
                id: owner.id,
                name: owner.name,
                color: OWNER_COLORS[i % OWNER_COLORS.length],
            })),
        ];
    }, [owners, selectedOwnerId]);

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
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
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
                            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
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
                        labelFormatter={(label) => formatMonthYear(label + '-01')}
                    />
                    {linesToShow.length > 1 && (
                        <Legend
                            wrapperStyle={{ color: 'var(--color-text-secondary)' }}
                        />
                    )}
                    {linesToShow.map((line) => (
                        <Line
                            key={line.id}
                            type="monotone"
                            dataKey={line.id}
                            name={line.name}
                            stroke={line.color}
                            strokeWidth={line.id === 'combined' ? 3 : 2}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
