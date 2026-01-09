import { TRANSACTION_TYPE_ICONS, type Transaction } from '@/models';
import { formatCurrency, formatDate } from '@/utils/date';

interface BigExpenseListProps {
    expenses: Transaction[];
    onExpenseClick?: (expense: Transaction) => void;
}

/**
 * List of big expenses with visual emphasis
 */
export function BigExpenseList({ expenses, onExpenseClick }: BigExpenseListProps) {
    if (expenses.length === 0) {
        return (
            <div className="card">
                <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                    <div className="empty-state-icon">✨</div>
                    <div className="empty-state-title">No big expenses</div>
                    <div className="empty-state-text">You're doing great!</div>
                </div>
            </div>
        );
    }

    return (
        <div className="list">
            {expenses.map((expense) => (
                <div
                    key={expense.id}
                    className="list-item"
                    onClick={() => onExpenseClick?.(expense)}
                    role="button"
                    tabIndex={0}
                    style={{ borderLeft: '3px solid var(--color-expense)' }}
                >
                    <div className="list-item-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                        {TRANSACTION_TYPE_ICONS[expense.type]}
                    </div>
                    <div className="list-item-content">
                        <div className="list-item-title">{expense.description}</div>
                        <div className="list-item-subtitle">
                            {formatDate(expense.date)} • {expense.category}
                            {expense.tag && (
                                <span className="badge badge-expense" style={{ marginLeft: 'var(--space-xs)' }}>
                                    {expense.tag}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="list-item-value text-expense">
                        {formatCurrency(expense.amount)}
                    </div>
                </div>
            ))}
        </div>
    );
}
