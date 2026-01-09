import { useState, useMemo } from 'react';
import {
    TRANSACTION_TYPE_ICONS,
    TRANSACTION_TYPE_LABELS,
    type Transaction,
    type TransactionType,
    type Account
} from '@/models';
import { formatCurrency, formatDate, getCurrentMonth } from '@/utils/date';

interface TransactionsPageProps {
    transactions: Transaction[];
    accounts: Account[];
    onUpdateTag: (transactionId: string, tag: string) => void;
}

type FilterType = 'all' | TransactionType;

export function Transactions({ transactions, accounts, onUpdateTag }: TransactionsPageProps) {
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [filterMonth, setFilterMonth] = useState<string>(getCurrentMonth());
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [tagInput, setTagInput] = useState('');

    // Get unique months from transactions
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        for (const t of transactions) {
            months.add(t.date.substring(0, 7));
        }
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        return transactions
            .filter((t) => {
                if (filterType !== 'all' && t.type !== filterType) return false;
                if (filterMonth && !t.date.startsWith(filterMonth)) return false;
                return true;
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions, filterType, filterMonth]);

    // Get account name
    const getAccountName = (accountId: string) => {
        return accounts.find((a) => a.id === accountId)?.name || 'Unknown';
    };

    // Handle tag submission
    const handleTagSubmit = () => {
        if (selectedTransaction && tagInput.trim()) {
            onUpdateTag(selectedTransaction.id, tagInput.trim());
            setSelectedTransaction(null);
            setTagInput('');
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Transactions</h1>
                    <p className="page-subtitle">{filteredTransactions.length} transactions</p>
                </div>

                {/* Filters */}
                <div className="mb-lg">
                    {/* Type filter */}
                    <div className="flex gap-sm mb-md" style={{ overflowX: 'auto', paddingBottom: 'var(--space-xs)' }}>
                        <button
                            className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterType('all')}
                        >
                            All
                        </button>
                        {(['expense', 'income', 'investment', 'transfer'] as TransactionType[]).map((type) => (
                            <button
                                key={type}
                                className={`btn ${filterType === type ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilterType(type)}
                            >
                                {TRANSACTION_TYPE_ICONS[type]} {TRANSACTION_TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>

                    {/* Month filter */}
                    <select
                        className="input"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                    >
                        <option value="">All time</option>
                        {availableMonths.map((month) => (
                            <option key={month} value={month}>
                                {new Date(month + '-01').toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Transaction list */}
                <div className="list">
                    {filteredTransactions.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">No transactions</div>
                            <div className="empty-state-text">Import statements to see transactions</div>
                        </div>
                    ) : (
                        filteredTransactions.map((t) => (
                            <div
                                key={t.id}
                                className="list-item"
                                onClick={() => {
                                    setSelectedTransaction(t);
                                    setTagInput(t.tag || '');
                                }}
                                role="button"
                                tabIndex={0}
                            >
                                <div
                                    className="list-item-icon"
                                    style={{
                                        background: t.type === 'expense' ? 'rgba(239, 68, 68, 0.2)' :
                                            t.type === 'income' ? 'rgba(16, 185, 129, 0.2)' :
                                                t.type === 'investment' ? 'rgba(99, 102, 241, 0.2)' :
                                                    'rgba(107, 107, 128, 0.2)'
                                    }}
                                >
                                    {TRANSACTION_TYPE_ICONS[t.type]}
                                </div>
                                <div className="list-item-content">
                                    <div className="list-item-title truncate">{t.description}</div>
                                    <div className="list-item-subtitle">
                                        {formatDate(t.date)} • {getAccountName(t.accountId)}
                                        {t.tag && (
                                            <span
                                                className="badge"
                                                style={{
                                                    marginLeft: 'var(--space-xs)',
                                                    background: 'var(--color-bg-hover)',
                                                    color: 'var(--color-text-secondary)',
                                                }}
                                            >
                                                {t.tag}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={`list-item-value ${t.type === 'expense' ? 'text-expense' : t.type === 'income' ? 'text-income' : 'text-investment'}`}>
                                    {formatCurrency(t.amount)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Tag modal */}
                {selectedTransaction && (
                    <div
                        className="fixed inset-0 flex items-center justify-center"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            zIndex: 200,
                            padding: 'var(--space-md)',
                        }}
                        onClick={() => setSelectedTransaction(null)}
                    >
                        <div
                            className="card w-full"
                            style={{ maxWidth: '400px' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-lg font-semibold mb-md">Tag Transaction</div>
                            <div className="text-sm text-secondary mb-md truncate">
                                {selectedTransaction.description}
                            </div>
                            <input
                                type="text"
                                className="input mb-md"
                                placeholder="Enter tag (e.g., 'Vacation', 'Medical')"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-md">
                                <button
                                    className="btn btn-secondary flex-1"
                                    onClick={() => setSelectedTransaction(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary flex-1"
                                    onClick={handleTagSubmit}
                                >
                                    Save Tag
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
