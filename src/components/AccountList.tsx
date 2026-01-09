import { ACCOUNT_TYPE_ICONS, type Account, type Snapshot } from '@/models';
import { formatCurrency } from '@/utils/date';

interface AccountListProps {
    accounts: Account[];
    snapshots: Snapshot[];
    onAccountClick?: (account: Account) => void;
}

/**
 * List of accounts grouped by owner with latest balances
 */
export function AccountList({ accounts, snapshots, onAccountClick }: AccountListProps) {
    // Get latest balance for each account
    const getLatestBalance = (accountId: string): number | null => {
        const accountSnapshots = snapshots
            .filter((s) => s.accountId === accountId)
            .sort((a, b) => b.date.localeCompare(a.date));

        return accountSnapshots.length > 0 ? accountSnapshots[0].balance : null;
    };

    if (accounts.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">🏦</div>
                <div className="empty-state-title">No accounts yet</div>
                <div className="empty-state-text">Add your first account in Settings</div>
            </div>
        );
    }

    return (
        <div className="list">
            {accounts.map((account) => {
                const balance = getLatestBalance(account.id);

                return (
                    <div
                        key={account.id}
                        className="list-item"
                        onClick={() => onAccountClick?.(account)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="list-item-icon">
                            {ACCOUNT_TYPE_ICONS[account.type]}
                        </div>
                        <div className="list-item-content">
                            <div className="list-item-title">{account.name}</div>
                            <div className="list-item-subtitle">{account.institution}</div>
                        </div>
                        <div className="list-item-value">
                            {balance !== null ? formatCurrency(balance) : '—'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
