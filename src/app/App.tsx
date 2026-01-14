import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { Dashboard, Import, NetWorth, Transactions, Settings } from '@/pages';
import type { Account, Transaction, Snapshot } from '@/models';
import { getAccounts, getTransactions, getSnapshots, getImports, addTransactions, addAccount, addSnapshot, addImport, deleteTransactionsByImportId, deleteImportRecord, deleteSnapshotsByImportId } from '@/services/sheetsService';
import type { ImportRecord } from '@/models';

// ... (existing code)

function App() {
    // State management
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [imports, setImports] = useState<ImportRecord[]>([]); // New state
    const [existingHashes] = useState<Set<string>>(new Set());

    // Load data from Sheets on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedAccounts, loadedTransactions, loadedSnapshots, loadedImports] = await Promise.all([
                    getAccounts(),
                    getTransactions(),
                    getSnapshots(),
                    getImports()
                ]);

                if (loadedAccounts) setAccounts(loadedAccounts);
                if (loadedTransactions) setTransactions(loadedTransactions);
                if (loadedSnapshots) setSnapshots(loadedSnapshots);
                if (loadedImports) setImports(loadedImports);
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        };
        loadData();
    }, []);

    // ... (existing code)


    const handleDeleteImport = useCallback(async (record: ImportRecord) => {
        if (!confirm(`Delete import "${record.fileName}"? This will remove ${record.transactionCount} transactions.`)) return;

        // 1. Delete Transactions locally
        setTransactions(prev => prev.filter(t => t.importId !== record.id));

        // 2. Delete Import Record locally
        setImports(prev => prev.filter(i => i.id !== record.id));

        // 3. Delete from Sheets
        console.log('App: Deleting transactions...');
        await deleteTransactionsByImportId(record.id);
        console.log('App: Deleting snapshots...');
        await deleteSnapshotsByImportId(record.id);
        console.log('App: Deleting import record...');
        await deleteImportRecord(record.id);
    }, []);

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

    const handleAddAccount = useCallback(async (account: Account) => {
        setAccounts((prev) => [...prev, account]);

        // Persist to Google Sheets
        console.log('App: Saving new account to Sheets...', account.name);
        const success = await addAccount(account);
        if (success) {
            console.log('App: Successfully saved account to Sheets');
        } else {
            console.error('App: Failed to save account to Sheets');
        }
    }, []);

    const handleImportTransactions = useCallback(async (newTransactions: Transaction[], importRecord?: ImportRecord) => {
        setTransactions((prev) => [...prev, ...newTransactions]);

        // Persist to Google Sheets
        console.log('App: Saving imported transactions to Sheets...', newTransactions.length);
        const success = await addTransactions(newTransactions);

        if (success) {
            console.log('App: Successfully saved transactions to Sheets');
            // Persist Import Record
            if (importRecord) {
                setImports(prev => [...prev, importRecord]);
                await addImport(importRecord);
            }
        } else {
            console.error('App: Failed to save transactions to Sheets');
        }
    }, []);

    const handleUpdateTag = useCallback((transactionId: string, tag: string) => {
        setTransactions((prev) =>
            prev.map((t) => (t.id === transactionId ? { ...t, tag } : t))
        );
    }, []);

    const handleSnapshot = useCallback(async (snapshot: Snapshot) => {
        setSnapshots((prev) => [...prev, snapshot]);

        // Persist to Google Sheets
        console.log('App: Saving snapshot to Sheets...', snapshot);
        const success = await addSnapshot(snapshot);
        if (success) {
            console.log('App: Successfully saved snapshot to Sheets');
        } else {
            console.error('App: Failed to save snapshot to Sheets');
        }
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
                                onSnapshot={handleSnapshot}
                                imports={imports}
                                onDeleteImport={handleDeleteImport}
                            />
                        }
                    />
                    <Route
                        path="/net-worth"
                        element={<NetWorth snapshots={snapshots} accounts={accounts} />}
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
