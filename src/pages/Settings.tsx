import { useState } from 'react';
import {
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_TYPE_ICONS,
    type Account,
    type AccountType,
    type AccountProduct,
    UOB_PRODUCTS
} from '@/models';
import {
    requestNotificationPermission,
    getNotificationPermission,
    isSheetsConfigured
} from '@/services';

interface SettingsPageProps {
    accounts: Account[];
    onAddAccount: (account: Account) => void;
}

const SG_BANKS = [
    'DBS',
    'POSB',
    'OCBC',
    'UOB',
    'Standard Chartered',
    'HSBC',
    'Citibank',
    'Trust Bank',
    'MariBank',
    'GXS Bank',
];

const BROKERAGE_INSTITUTIONS = [
    'Syfe',
    'StashAway',
    'Endowus',
    'Interactive Brokers',
    'Tiger Brokers',
    'Moomoo',
    'Vanguard',
    'Charles Schwab',
];

const CREDIT_CARD_ISSUERS = [
    'DBS',
    'OCBC',
    'UOB',
    'American Express',
    'HSBC',
    'Standard Chartered',
    'Citibank',
];

const RETIREMENT_PROVIDERS = [
    'CPF',
    'SRS (DBS)',
    'SRS (OCBC)',
    'SRS (UOB)',
];


export function Settings({ accounts, onAddAccount }: SettingsPageProps) {
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountForm, setAccountForm] = useState({
        institution: '',
        name: '',
        type: 'bank' as AccountType,
        productId: '',
    });

    const notificationPermission = getNotificationPermission();
    const sheetsConfigured = isSheetsConfigured();

    const handleAddAccount = () => {
        if (!accountForm.institution || !accountForm.name) return;

        // Check for duplicates
        const isDuplicate = accounts.some(
            (acc) =>
                acc.institution.toLowerCase() === accountForm.institution.toLowerCase() &&
                acc.name.toLowerCase() === accountForm.name.toLowerCase()
        );

        if (isDuplicate) {
            setError('This account already exists.');
            return;
        }

        const account: Account = {
            id: `account-${Date.now()}`,
            productId: accountForm.productId || undefined,
            institution: accountForm.institution,
            name: accountForm.name,
            type: accountForm.type,
        };

        onAddAccount(account);
        setAccountForm({
            institution: '',
            name: '',
            type: 'bank',
            productId: '',
        });
        setError(null);
        setShowAddAccount(false);
    };

    const handleEnableNotifications = async () => {
        await requestNotificationPermission();
        // Force re-render
        window.location.reload();
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Manage your accounts and preferences</p>
                </div>

                {/* Connection Status */}
                <section className="section">
                    <h2 className="section-title mb-md">Connection Status</h2>
                    <div className="card">
                        <div className="flex justify-between items-center mb-md">
                            <span>Google Sheets</span>
                            {sheetsConfigured ? (
                                <span className="badge badge-income">Connected</span>
                            ) : (
                                <span className="badge badge-expense">Not configured</span>
                            )}
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Notifications</span>
                            {notificationPermission === 'granted' ? (
                                <span className="badge badge-income">Enabled</span>
                            ) : notificationPermission === 'denied' ? (
                                <span className="badge badge-expense">Blocked</span>
                            ) : (
                                <button className="btn btn-secondary" onClick={handleEnableNotifications}>
                                    Enable
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Accounts */}
                <section className="section">
                    <div className="section-header">
                        <h2 className="section-title">Accounts</h2>
                        <button
                            className="btn btn-ghost"
                            onClick={() => {
                                setError(null);
                                setShowAddAccount(true);
                            }}
                        >
                            + Add
                        </button>
                    </div>

                    {accounts.length === 0 ? (
                        <div className="card">
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <div className="empty-state-icon">🏦</div>
                                <div className="empty-state-title">No accounts yet</div>
                                <div className="empty-state-text">
                                    Add your bank accounts, credit cards, etc.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="list">
                            {accounts.map((account) => (
                                <div key={account.id} className="list-item">
                                    <div className="list-item-icon">
                                        {ACCOUNT_TYPE_ICONS[account.type]}
                                    </div>
                                    <div className="list-item-content">
                                        <div className="list-item-title">{account.name}</div>
                                        <div className="list-item-subtitle">
                                            {account.institution}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Account Form */}
                    {showAddAccount && (
                        <div className="card mt-md">
                            {/* 1. Account Type */}
                            <select
                                className="input mb-md"
                                value={accountForm.type}
                                onChange={(e) => {
                                    const newType = e.target.value as AccountType;
                                    setAccountForm({
                                        type: newType,
                                        institution: '',
                                        name: '',
                                        productId: '',
                                    });
                                    setError(null);
                                }}
                            >
                                <option value="" disabled>Select Account Type</option>
                                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {ACCOUNT_TYPE_ICONS[value as AccountType]} {label}
                                    </option>
                                ))}
                            </select>

                            {/* 2. Institution Field - Filtered by Type */}
                            {accountForm.type && (
                                <>
                                    <select
                                        className="input mb-md"
                                        value={(() => {
                                            const currentList =
                                                ['bank', 'hysa'].includes(accountForm.type) ? SG_BANKS :
                                                    accountForm.type === 'credit' ? CREDIT_CARD_ISSUERS :
                                                        accountForm.type === 'brokerage' ? BROKERAGE_INSTITUTIONS :
                                                            accountForm.type === 'retirement' ? RETIREMENT_PROVIDERS : [];

                                            return currentList.includes(accountForm.institution) ? accountForm.institution : accountForm.institution === '' ? '' : 'Other';
                                        })()}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAccountForm(prev => ({
                                                ...prev,
                                                institution: val === 'Other' ? '' : val,
                                                productId: '',
                                                name: val === 'UOB' ? '' : (val === 'Other' ? '' : prev.name)
                                            }));
                                            setError(null);
                                        }}
                                    >
                                        <option value="" disabled>Select Institution</option>
                                        {(() => {
                                            const currentList =
                                                ['bank', 'hysa'].includes(accountForm.type) ? SG_BANKS :
                                                    accountForm.type === 'credit' ? CREDIT_CARD_ISSUERS :
                                                        accountForm.type === 'brokerage' ? BROKERAGE_INSTITUTIONS :
                                                            accountForm.type === 'retirement' ? RETIREMENT_PROVIDERS : [];

                                            return currentList.map((inst) => (
                                                <option key={inst} value={inst}>{inst}</option>
                                            ));
                                        })()}
                                        <option value="Other">Other...</option>
                                    </select>

                                    {/* Manual entry for "Other" or custom input */}
                                    {(!(() => {
                                        const currentList =
                                            ['bank', 'hysa'].includes(accountForm.type) ? SG_BANKS :
                                                accountForm.type === 'credit' ? CREDIT_CARD_ISSUERS :
                                                    accountForm.type === 'brokerage' ? BROKERAGE_INSTITUTIONS :
                                                        accountForm.type === 'retirement' ? RETIREMENT_PROVIDERS : [];
                                        return currentList.includes(accountForm.institution);
                                    })() || accountForm.institution === '') && (
                                            <input
                                                type="text"
                                                className="input mb-md"
                                                placeholder="Enter institution name"
                                                value={accountForm.institution}
                                                onChange={(e) => {
                                                    setAccountForm((prev) => ({ ...prev, institution: e.target.value }));
                                                    setError(null);
                                                }}
                                                autoFocus
                                            />
                                        )}
                                </>
                            )}

                            {/* 3. Name Field - Conditional UOB Logic */}
                            {accountForm.institution && (
                                accountForm.institution === 'UOB' ? (
                                    <select
                                        className="input mb-md"
                                        value={accountForm.productId}
                                        onChange={(e) => {
                                            const product = UOB_PRODUCTS.find(p => p.id === e.target.value);
                                            if (product) {
                                                setAccountForm(prev => ({
                                                    ...prev,
                                                    productId: product.id,
                                                    name: product.name,
                                                    type: product.type // UOB products have fixed types
                                                }));
                                            }
                                            setError(null);
                                        }}
                                    >
                                        <option value="" disabled>Select Product</option>
                                        {UOB_PRODUCTS.map((product: AccountProduct) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="input mb-md"
                                        placeholder="Account name (e.g., Savings, My Portfolio)"
                                        value={accountForm.name}
                                        onChange={(e) => {
                                            setAccountForm((prev) => ({ ...prev, name: e.target.value }));
                                            setError(null);
                                        }}
                                    />
                                )
                            )}

                            {error && (
                                <div className="text-expense text-sm mb-md flex items-center gap-sm">
                                    <span>⚠️</span> {error}
                                </div>
                            )}

                            <div className="flex gap-md">
                                <button
                                    className="btn btn-secondary flex-1"
                                    onClick={() => setShowAddAccount(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary flex-1"
                                    onClick={handleAddAccount}
                                >
                                    Add Account
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* App Info */}
                <section className="section">
                    <h2 className="section-title mb-md">About</h2>
                    <div className="card">
                        <div className="text-sm text-secondary">
                            Finance Tracker v1.0.0
                            <br />
                            Mobile-first PWA for tracking net worth
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
