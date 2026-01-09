import { useState } from 'react';
import {
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_TYPE_ICONS,
    type Owner,
    type Account,
    type AccountType
} from '@/models';
import {
    requestNotificationPermission,
    getNotificationPermission,
    isSheetsConfigured
} from '@/services';

interface SettingsPageProps {
    owners: Owner[];
    accounts: Account[];
    onAddOwner: (owner: Owner) => void;
    onAddAccount: (account: Account) => void;
}

export function Settings({ owners, accounts, onAddOwner, onAddAccount }: SettingsPageProps) {
    const [showAddOwner, setShowAddOwner] = useState(false);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [ownerName, setOwnerName] = useState('');
    const [accountForm, setAccountForm] = useState({
        ownerId: '',
        institution: '',
        name: '',
        type: 'bank' as AccountType,
    });

    const notificationPermission = getNotificationPermission();
    const sheetsConfigured = isSheetsConfigured();

    const handleAddOwner = () => {
        if (!ownerName.trim()) return;

        const owner: Owner = {
            id: `owner-${Date.now()}`,
            name: ownerName.trim(),
        };

        onAddOwner(owner);
        setOwnerName('');
        setShowAddOwner(false);
    };

    const handleAddAccount = () => {
        if (!accountForm.ownerId || !accountForm.institution || !accountForm.name) return;

        const account: Account = {
            id: `account-${Date.now()}`,
            ownerId: accountForm.ownerId,
            institution: accountForm.institution.trim(),
            name: accountForm.name.trim(),
            type: accountForm.type,
        };

        onAddAccount(account);
        setAccountForm({
            ownerId: '',
            institution: '',
            name: '',
            type: 'bank',
        });
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

                {/* Owners */}
                <section className="section">
                    <div className="section-header">
                        <h2 className="section-title">Owners</h2>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowAddOwner(true)}
                        >
                            + Add
                        </button>
                    </div>

                    {owners.length === 0 ? (
                        <div className="card">
                            <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                                <div className="empty-state-icon">👤</div>
                                <div className="empty-state-title">No owners yet</div>
                                <div className="empty-state-text">Add yourself and your partner</div>
                            </div>
                        </div>
                    ) : (
                        <div className="list">
                            {owners.map((owner) => (
                                <div key={owner.id} className="list-item">
                                    <div className="list-item-icon">👤</div>
                                    <div className="list-item-content">
                                        <div className="list-item-title">{owner.name}</div>
                                        <div className="list-item-subtitle">
                                            {accounts.filter((a) => a.ownerId === owner.id).length} accounts
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Owner Form */}
                    {showAddOwner && (
                        <div className="card mt-md">
                            <input
                                type="text"
                                className="input mb-md"
                                placeholder="Owner name"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-md">
                                <button
                                    className="btn btn-secondary flex-1"
                                    onClick={() => setShowAddOwner(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary flex-1"
                                    onClick={handleAddOwner}
                                >
                                    Add Owner
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Accounts */}
                <section className="section">
                    <div className="section-header">
                        <h2 className="section-title">Accounts</h2>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowAddAccount(true)}
                            disabled={owners.length === 0}
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
                                    {owners.length === 0
                                        ? 'Add an owner first'
                                        : 'Add your bank accounts, credit cards, etc.'
                                    }
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
                                            {account.institution} • {owners.find((o) => o.id === account.ownerId)?.name}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Account Form */}
                    {showAddAccount && (
                        <div className="card mt-md">
                            <select
                                className="input mb-md"
                                value={accountForm.ownerId}
                                onChange={(e) => setAccountForm((prev) => ({ ...prev, ownerId: e.target.value }))}
                            >
                                <option value="">Select owner</option>
                                {owners.map((owner) => (
                                    <option key={owner.id} value={owner.id}>{owner.name}</option>
                                ))}
                            </select>

                            <input
                                type="text"
                                className="input mb-md"
                                placeholder="Institution (e.g., DBS, OCBC)"
                                value={accountForm.institution}
                                onChange={(e) => setAccountForm((prev) => ({ ...prev, institution: e.target.value }))}
                            />

                            <input
                                type="text"
                                className="input mb-md"
                                placeholder="Account name"
                                value={accountForm.name}
                                onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))}
                            />

                            <select
                                className="input mb-md"
                                value={accountForm.type}
                                onChange={(e) => setAccountForm((prev) => ({ ...prev, type: e.target.value as AccountType }))}
                            >
                                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {ACCOUNT_TYPE_ICONS[value as AccountType]} {label}
                                    </option>
                                ))}
                            </select>

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
