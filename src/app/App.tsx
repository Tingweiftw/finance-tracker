import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { Dashboard, Import, NetWorth, Transactions, Settings } from '@/pages';
import type { Owner, Account, Transaction, Snapshot } from '@/models';

// Mock data for development
const MOCK_OWNERS: Owner[] = [
    { id: 'owner-1', name: 'John' },
    { id: 'owner-2', name: 'Jane' },
];

const MOCK_ACCOUNTS: Account[] = [
    { id: 'acc-1', ownerId: 'owner-1', institution: 'DBS', name: 'Savings', type: 'bank' },
    { id: 'acc-2', ownerId: 'owner-1', institution: 'DBS', name: 'Credit Card', type: 'credit' },
    { id: 'acc-3', ownerId: 'owner-1', institution: 'Syfe', name: 'REIT+', type: 'brokerage' },
    { id: 'acc-4', ownerId: 'owner-2', institution: 'OCBC', name: 'Savings', type: 'bank' },
    { id: 'acc-5', ownerId: 'owner-2', institution: 'StashAway', name: 'Portfolio', type: 'brokerage' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: 't-1', date: '2026-01-05', ownerId: 'owner-1', accountId: 'acc-1', type: 'expense', category: 'Food & Dining', amount: -85.50, description: 'Dinner at Restaurant' },
    { id: 't-2', date: '2026-01-04', ownerId: 'owner-1', accountId: 'acc-2', type: 'expense', category: 'Online Shopping', amount: -250.00, description: 'Amazon Order' },
    { id: 't-3', date: '2026-01-03', ownerId: 'owner-1', accountId: 'acc-1', type: 'income', category: 'Salary', amount: 8500.00, description: 'Monthly Salary' },
    { id: 't-4', date: '2026-01-02', ownerId: 'owner-1', accountId: 'acc-3', type: 'investment', category: 'Dividend', amount: 125.40, description: 'REIT Dividend' },
    { id: 't-5', date: '2026-01-01', ownerId: 'owner-2', accountId: 'acc-4', type: 'expense', category: 'Transport', amount: -45.00, description: 'Grab Rides' },
    { id: 't-6', date: '2025-12-28', ownerId: 'owner-1', accountId: 'acc-2', type: 'expense', category: 'Healthcare', amount: -1200.00, description: 'Medical Check-up', tag: 'Medical' },
    { id: 't-7', date: '2025-12-25', ownerId: 'owner-2', accountId: 'acc-5', type: 'investment', category: 'Interest', amount: 89.20, description: 'Portfolio Interest' },
];

const MOCK_SNAPSHOTS: Snapshot[] = [
    // December 2025
    { date: '2025-12-01', ownerId: 'owner-1', accountId: 'acc-1', balance: 45000 },
    { date: '2025-12-01', ownerId: 'owner-1', accountId: 'acc-3', balance: 32000 },
    { date: '2025-12-01', ownerId: 'owner-2', accountId: 'acc-4', balance: 28000 },
    { date: '2025-12-01', ownerId: 'owner-2', accountId: 'acc-5', balance: 15000 },
    // January 2026
    { date: '2026-01-01', ownerId: 'owner-1', accountId: 'acc-1', balance: 48500 },
    { date: '2026-01-01', ownerId: 'owner-1', accountId: 'acc-3', balance: 33200 },
    { date: '2026-01-01', ownerId: 'owner-2', accountId: 'acc-4', balance: 29500 },
    { date: '2026-01-01', ownerId: 'owner-2', accountId: 'acc-5', balance: 15800 },
];

function App() {
    // State management
    const [owners, setOwners] = useState<Owner[]>(MOCK_OWNERS);
    const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
    const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
    const [snapshots, setSnapshots] = useState<Snapshot[]>(MOCK_SNAPSHOTS);
    const [existingHashes] = useState<Set<string>>(new Set());

    // Calculate last import dates
    const [lastImportDates, setLastImportDates] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const dates = new Map<string, string>();
        for (const t of transactions) {
            const current = dates.get(t.accountId);
            if (!current || t.date > current) {
                dates.set(t.accountId, t.date);
            }
        }
        setLastImportDates(dates);
    }, [transactions]);

    // Handlers
    const handleAddOwner = useCallback((owner: Owner) => {
        setOwners((prev) => [...prev, owner]);
    }, []);

    const handleAddAccount = useCallback((account: Account) => {
        setAccounts((prev) => [...prev, account]);
    }, []);

    const handleImportTransactions = useCallback((newTransactions: Transaction[]) => {
        setTransactions((prev) => [...prev, ...newTransactions]);
    }, []);

    const handleUpdateTag = useCallback((transactionId: string, tag: string) => {
        setTransactions((prev) =>
            prev.map((t) => (t.id === transactionId ? { ...t, tag } : t))
        );
    }, []);

    return (
        <BrowserRouter>
            <div className="app">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Dashboard
                                owners={owners}
                                accounts={accounts}
                                transactions={transactions}
                                snapshots={snapshots}
                                lastImportDates={lastImportDates}
                            />
                        }
                    />
                    <Route
                        path="/import"
                        element={
                            <Import
                                accounts={accounts}
                                existingHashes={existingHashes}
                                onImport={handleImportTransactions}
                            />
                        }
                    />
                    <Route
                        path="/net-worth"
                        element={<NetWorth owners={owners} snapshots={snapshots} />}
                    />
                    <Route
                        path="/transactions"
                        element={
                            <Transactions
                                transactions={transactions}
                                accounts={accounts}
                                onUpdateTag={handleUpdateTag}
                            />
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <Settings
                                owners={owners}
                                accounts={accounts}
                                onAddOwner={handleAddOwner}
                                onAddAccount={handleAddAccount}
                            />
                        }
                    />
                </Routes>

                {/* Bottom Navigation */}
                <nav className="bottom-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">🏠</span>
                        <span>Home</span>
                    </NavLink>
                    <NavLink to="/import" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">📥</span>
                        <span>Import</span>
                    </NavLink>
                    <NavLink to="/net-worth" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">📈</span>
                        <span>Net Worth</span>
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">📋</span>
                        <span>Transactions</span>
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">⚙️</span>
                        <span>Settings</span>
                    </NavLink>
                </nav>
            </div>
        </BrowserRouter>
    );
}

export default App;
