import { useMemo } from 'react';
import { ACCOUNT_TYPE_ICONS, type Account } from '@/models';
import { formatMonthYear, getPreviousMonth, getCurrentMonth } from '@/utils/date';

interface ImportStatusCardProps {
    accounts: Account[];
    lastImportDates: Map<string, string>;
}

interface AccountStatus {
    account: Account;
    lastImport: string | null;
    isMissing: boolean;
    monthsMissing: number;
}

/**
 * Card showing import status for each account
 * Highlights accounts with missing statements
 */
export function ImportStatusCard({ accounts, lastImportDates }: ImportStatusCardProps) {
    const currentMonth = getCurrentMonth();
    const previousMonth = getPreviousMonth();

    // Calculate status for each account
    const accountStatuses = useMemo(() => {
        return accounts.map((account): AccountStatus => {
            const lastImport = lastImportDates.get(account.id) || null;

            if (!lastImport) {
                return {
                    account,
                    lastImport: null,
                    isMissing: true,
                    monthsMissing: 0,
                };
            }

            const lastImportMonth = lastImport.substring(0, 7);

            // Consider missing if last import is older than previous month
            const isMissing = lastImportMonth < previousMonth;

            // Calculate months missing
            let monthsMissing = 0;
            if (isMissing) {
                const lastDate = new Date(lastImportMonth + '-01');
                const currentDate = new Date(currentMonth + '-01');
                monthsMissing = Math.round(
                    (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
                );
            }

            return {
                account,
                lastImport,
                isMissing,
                monthsMissing,
            };
        });
    }, [accounts, lastImportDates, currentMonth, previousMonth]);

    const missingCount = accountStatuses.filter((s) => s.isMissing).length;

    if (accounts.length === 0) {
        return null;
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Import Status</span>
                {missingCount > 0 && (
                    <span className="badge badge-expense">
                        {missingCount} missing
                    </span>
                )}
            </div>

            <div className="list" style={{ marginTop: 'var(--space-sm)' }}>
                {accountStatuses.map(({ account, lastImport, isMissing, monthsMissing }) => (
                    <div
                        key={account.id}
                        className="flex items-center gap-md"
                        style={{
                            padding: 'var(--space-sm) 0',
                            borderBottom: '1px solid var(--color-bg-hover)',
                        }}
                    >
                        <span>{ACCOUNT_TYPE_ICONS[account.type]}</span>
                        <div className="flex-1">
                            <div className="text-sm font-medium truncate">{account.name}</div>
                            <div className="text-xs text-muted">
                                {lastImport
                                    ? `Last: ${formatMonthYear(lastImport)}`
                                    : 'Never imported'
                                }
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            {isMissing ? (
                                <span className="text-expense text-sm">
                                    {monthsMissing > 0 ? `${monthsMissing} months` : 'Missing'}
                                </span>
                            ) : (
                                <span className="text-success text-sm">✓ Up to date</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
