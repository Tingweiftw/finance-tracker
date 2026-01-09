import { useState, useCallback } from 'react';
import { ACCOUNT_TYPE_ICONS, type Account, type Transaction } from '@/models';
import { validateFileType } from '@/services/ingestionService';
import { parseCSV, generateTransactionHash } from '@/utils/csvParser';
import { processTransaction } from '@/services/classificationService';
import { formatDate } from '@/utils/date';

interface ImportPageProps {
    accounts: Account[];
    existingHashes: Set<string>;
    onImport: (transactions: Transaction[]) => void;
}

type ImportStep = 'select-account' | 'upload' | 'preview' | 'complete';

interface ImportState {
    step: ImportStep;
    selectedAccount: Account | null;
    file: File | null;
    parsedTransactions: Transaction[];
    duplicateCount: number;
    errors: string[];
}

export function Import({ accounts, existingHashes, onImport }: ImportPageProps) {
    const [state, setState] = useState<ImportState>({
        step: 'select-account',
        selectedAccount: null,
        file: null,
        parsedTransactions: [],
        duplicateCount: 0,
        errors: [],
    });

    const handleAccountSelect = (account: Account) => {
        setState((prev) => ({
            ...prev,
            step: 'upload',
            selectedAccount: account,
        }));
    };

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !state.selectedAccount) return;

        const validation = validateFileType(file);
        if (!validation.valid) {
            setState((prev) => ({
                ...prev,
                errors: [validation.error || 'Invalid file type'],
            }));
            return;
        }

        // Parse file
        const content = await file.text();
        const { rows, errors } = parseCSV(content);

        // Process transactions
        const transactions: Transaction[] = [];
        let duplicateCount = 0;

        for (const row of rows) {
            const hash = generateTransactionHash(row.date, row.description, row.amount);

            if (existingHashes.has(hash)) {
                duplicateCount++;
                continue;
            }

            const transaction = processTransaction(
                `${state.selectedAccount.id}-${hash}`,
                row.date,
                row.description,
                row.amount,
                state.selectedAccount.ownerId,
                state.selectedAccount.id,
                state.selectedAccount.type
            );

            transactions.push(transaction);
        }

        setState((prev) => ({
            ...prev,
            step: 'preview',
            file,
            parsedTransactions: transactions,
            duplicateCount,
            errors,
        }));
    }, [state.selectedAccount, existingHashes]);

    const handleConfirmImport = () => {
        onImport(state.parsedTransactions);
        setState((prev) => ({
            ...prev,
            step: 'complete',
        }));
    };

    const handleStartOver = () => {
        setState({
            step: 'select-account',
            selectedAccount: null,
            file: null,
            parsedTransactions: [],
            duplicateCount: 0,
            errors: [],
        });
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">Import</h1>
                    <p className="page-subtitle">
                        {state.step === 'select-account' && 'Select an account to import into'}
                        {state.step === 'upload' && `Importing to ${state.selectedAccount?.name}`}
                        {state.step === 'preview' && 'Review transactions before importing'}
                        {state.step === 'complete' && 'Import complete!'}
                    </p>
                </div>

                {/* Step: Select Account */}
                {state.step === 'select-account' && (
                    <div className="list">
                        {accounts.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🏦</div>
                                <div className="empty-state-title">No accounts yet</div>
                                <div className="empty-state-text">Add accounts in Settings first</div>
                            </div>
                        ) : (
                            accounts.map((account) => (
                                <button
                                    key={account.id}
                                    className="list-item w-full"
                                    onClick={() => handleAccountSelect(account)}
                                    style={{ textAlign: 'left' }}
                                >
                                    <div className="list-item-icon">
                                        {ACCOUNT_TYPE_ICONS[account.type]}
                                    </div>
                                    <div className="list-item-content">
                                        <div className="list-item-title">{account.name}</div>
                                        <div className="list-item-subtitle">{account.institution}</div>
                                    </div>
                                    <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Step: Upload File */}
                {state.step === 'upload' && (
                    <div>
                        <div
                            className="card"
                            style={{
                                border: '2px dashed var(--color-bg-hover)',
                                textAlign: 'center',
                                padding: 'var(--space-2xl)',
                                cursor: 'pointer',
                            }}
                        >
                            <input
                                type="file"
                                accept=".csv,.pdf"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                                <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>📄</div>
                                <div className="text-lg font-semibold mb-sm">Upload Statement</div>
                                <div className="text-secondary text-sm">CSV or PDF file</div>
                            </label>
                        </div>

                        {state.errors.length > 0 && (
                            <div className="card mt-lg" style={{ borderLeft: '3px solid var(--color-danger)' }}>
                                <div className="text-expense font-semibold mb-sm">Errors</div>
                                {state.errors.map((error, i) => (
                                    <div key={i} className="text-sm text-secondary">{error}</div>
                                ))}
                            </div>
                        )}

                        <button
                            className="btn btn-ghost w-full mt-lg"
                            onClick={handleStartOver}
                        >
                            ← Back to accounts
                        </button>
                    </div>
                )}

                {/* Step: Preview */}
                {state.step === 'preview' && (
                    <div>
                        {/* Summary */}
                        <div className="card mb-lg">
                            <div className="flex justify-between mb-md">
                                <span className="text-secondary">File</span>
                                <span className="font-medium">{state.file?.name}</span>
                            </div>
                            <div className="flex justify-between mb-md">
                                <span className="text-secondary">New transactions</span>
                                <span className="font-medium text-income">{state.parsedTransactions.length}</span>
                            </div>
                            {state.duplicateCount > 0 && (
                                <div className="flex justify-between mb-md">
                                    <span className="text-secondary">Duplicates skipped</span>
                                    <span className="font-medium text-muted">{state.duplicateCount}</span>
                                </div>
                            )}
                            {state.errors.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-secondary">Parse errors</span>
                                    <span className="font-medium text-expense">{state.errors.length}</span>
                                </div>
                            )}
                        </div>

                        {/* Transaction preview */}
                        <div className="section-title mb-md">Preview (first 10)</div>
                        <div className="list mb-lg">
                            {state.parsedTransactions.slice(0, 10).map((t) => (
                                <div key={t.id} className="list-item">
                                    <div className="list-item-content">
                                        <div className="list-item-title truncate">{t.description}</div>
                                        <div className="list-item-subtitle">
                                            {formatDate(t.date)} • {t.category}
                                        </div>
                                    </div>
                                    <div className={`list-item-value ${t.amount < 0 ? 'text-expense' : 'text-income'}`}>
                                        {t.amount < 0 ? '-' : '+'}{Math.abs(t.amount).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-md">
                            <button className="btn btn-secondary flex-1" onClick={handleStartOver}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary flex-1"
                                onClick={handleConfirmImport}
                                disabled={state.parsedTransactions.length === 0}
                            >
                                Import {state.parsedTransactions.length} transactions
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Complete */}
                {state.step === 'complete' && (
                    <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">Import Complete!</div>
                        <div className="empty-state-text mb-lg">
                            {state.parsedTransactions.length} transactions imported
                        </div>
                        <button className="btn btn-primary" onClick={handleStartOver}>
                            Import Another
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
