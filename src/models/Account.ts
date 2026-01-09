export type AccountType = 'bank' | 'hysa' | 'credit' | 'brokerage' | 'retirement';

export interface Account {
    id: string;
    ownerId: string;
    institution: string;
    name: string;
    type: AccountType;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    bank: 'Bank Account',
    hysa: 'High-Yield Savings',
    credit: 'Credit Card',
    brokerage: 'Brokerage',
    retirement: 'Retirement',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
    bank: '🏦',
    hysa: '💰',
    credit: '💳',
    brokerage: '📈',
    retirement: '🏖️',
};
