export type AccountType = 'bank' | 'hysa' | 'credit' | 'brokerage' | 'retirement';

export interface Account {
    id: string;
    productId?: string;
    institution: string;
    name: string;
    type: AccountType;
}

export interface AccountProduct {
    id: string;
    institution: string;
    name: string;
    type: AccountType;
}

export const UOB_PRODUCTS: AccountProduct[] = [
    { id: 'uob-one-fx', institution: 'UOB', name: 'UOB One (with FX+)', type: 'bank' },
    { id: 'uob-ladys', institution: 'UOB', name: 'UOB Lady\'s Savings', type: 'bank' },
    { id: 'uob-cc', institution: 'UOB', name: 'UOB Credit Card', type: 'credit' },
];

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
