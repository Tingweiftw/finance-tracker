import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { Dashboard, Import, NetWorth, Transactions, Settings } from '@/pages';
import type { Account, Transaction, Snapshot } from '@/models';

// Mock data for development
// No owners needed for single-user mode

const MOCK_ACCOUNTS: Account[] = [
    { id: 'acc-1', productId: 'uob-one-fx', institution: 'UOB', name: 'UOB One (with FX+)', type: 'bank' },
    { id: 'acc-2', productId: 'uob-ladys', institution: 'UOB', name: 'UOB Lady\'s Savings', type: 'hysa' },
    { id: 'acc-3', institution: 'DBS', name: 'Multiplier', type: 'bank' },
    { id: 'acc-4', institution: 'Syfe', name: 'REIT+', type: 'brokerage' },
    { id: 'acc-5', institution: 'StashAway', name: 'Portfolio', type: 'brokerage' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: 't-1', date: '2026-01-05', accountId: 'acc-1', type: 'expense', category: 'Food & Dining', amount: -85.50, description: 'Dinner at Restaurant' },
    { id: 't-2', date: '2026-01-04', accountId: 'acc-3', type: 'expense', category: 'Online Shopping', amount: -250.00, description: 'Amazon Order' },
    { id: 't-3', date: '2026-01-03', accountId: 'acc-1', type: 'income', category: 'Salary', amount: 8500.00, description: 'Monthly Salary' },
    { id: 't-4', date: '2026-01-02', accountId: 'acc-4', type: 'investment', category: 'Dividend', amount: 125.40, description: 'REIT Dividend' },
    { id: 't-5', date: '2025-12-28', accountId: 'acc-2', type: 'expense', category: 'Healthcare', amount: -1200.00, description: 'Medical Check-up', tag: 'Medical' },
    { id: 't-6', date: '2025-12-25', accountId: 'acc-5', type: 'investment', category: 'Interest', amount: 89.20, description: 'Portfolio Interest' },
];

const MOCK_SNAPSHOTS: Snapshot[] = [
    // December 2025
    // December 2025
    { date: '2025-12-01', accountId: 'acc-1', balance: 45000 },
    { date: '2025-12-01', accountId: 'acc-3', balance: 28000 },
    { date: '2025-12-01', accountId: 'acc-4', balance: 32000 },
    { date: '2025-12-01', accountId: 'acc-5', balance: 15000 },
    // January 2026
    { date: '2026-01-01', accountId: 'acc-1', balance: 48500 },
    { date: '2026-01-01', accountId: 'acc-3', balance: 29500 },
    { date: '2026-01-01', accountId: 'acc-4', balance: 33200 },
    { date: '2026-01-01', accountId: 'acc-5', balance: 15800 },
];

function App() {
    // State management
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
                {/* Mobile Header with Settings Gear */}
                <header className="mobile-header">
                    <NavLink to="/settings" className="settings-gear">
                        ⚙️
                    </NavLink>
                </header>

                <Routes>
                    <Route
                        path="/"
                        element={
                            <Dashboard
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
                        element={<NetWorth snapshots={snapshots} />}
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
                                accounts={accounts}
                                onAddAccount={handleAddAccount}
                            />
                        }
                    />
                </Routes>

                {/* Bottom Navigation - 4 items on mobile, 5 on desktop */}
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
                    {/* Settings only shown in nav on desktop via CSS */}
                    <NavLink to="/settings" className={({ isActive }) => `nav-item nav-item-settings ${isActive ? 'active' : ''}`}>
                        <span className="nav-item-icon">⚙️</span>
                        <span>Settings</span>
                    </NavLink>
                </nav>
            </div>
        </BrowserRouter>
    );
}

export default App;
