import { useState, useCallback } from 'react';
import { ACCOUNT_TYPE_ICONS, type Account, type Transaction, type TransactionType, TRANSACTION_TYPE_LABELS } from '@/models';
import { validateFileType } from '@/services/ingestionService';
import { parseCSV, generateTransactionHash } from '@/utils/csvParser';
import { extractTextFromPDF, isPDFFile } from '@/utils/pdfExtractor';
import { parseUOBStatement } from '@/services/parsers/uobStatementParser';
import { processTransaction, CATEGORIES } from '@/services/classificationService';
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
    isLoading: boolean;
    openingBalance: number | null;
    closingBalance: number | null;
}

export function Import({ accounts, existingHashes, onImport }: ImportPageProps) {
    const [state, setState] = useState<ImportState>({
        step: 'select-account',
        selectedAccount: null,
        file: null,
        parsedTransactions: [],
        duplicateCount: 0,
        errors: [],
        isLoading: false,
        openingBalance: null,
        closingBalance: null,
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

        setState((prev) => ({ ...prev, isLoading: true, errors: [] }));

        try {
            let rows: { date: string; description: string; amount: number; balance?: number }[] = [];
            let parseErrors: string[] = [];

            if (isPDFFile(file)) {
                // PDF parsing flow
                const pdfText = await extractTextFromPDF(file);
                const parsedStatement = parseUOBStatement(pdfText);

                rows = parsedStatement.transactions.map(t => ({
                    date: t.date,
                    description: t.description,
                    amount: t.amount,
                    balance: t.balance,
                }));

                // Store opening/closing balance
                setState(prev => ({
                    ...prev,
                    openingBalance: parsedStatement.openingBalance,
                    closingBalance: parsedStatement.closingBalance,
                }));
            } else {
                // CSV parsing flow
                const content = await file.text();
                const result = parseCSV(content);
                rows = result.rows;
                parseErrors = result.errors;
            }

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
                errors: parseErrors,
                isLoading: false,
            }));
        } catch (error) {
            setState((prev) => ({
                ...prev,
                errors: [error instanceof Error ? error.message : 'Failed to parse file'],
                isLoading: false,
            }));
        }
    }, [state.selectedAccount, existingHashes]);

    const handleTransactionTypeChange = (transactionId: string, newType: TransactionType) => {
        setState((prev) => ({
            ...prev,
            parsedTransactions: prev.parsedTransactions.map((t) =>
                t.id === transactionId
                    ? { ...t, type: newType, amount: Math.abs(t.amount) * (newType === 'expense' ? -1 : 1) }
                    : t
            ),
        }));
    };

    const handleCategoryChange = (transactionId: string, newCategory: string) => {
        setState((prev) => ({
            ...prev,
            parsedTransactions: prev.parsedTransactions.map((t) =>
                t.id === transactionId ? { ...t, category: newCategory } : t
            ),
        }));
    };

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
            isLoading: false,
            openingBalance: null,
            closingBalance: null,
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
                                    style={{ textAlign: 'left', color: 'inherit' }}
                                >
                                    <div className="list-item-icon">
                                        {ACCOUNT_TYPE_ICONS[account.type]}
                                    </div>
                                    <div className="list-item-content">
                                        <div className="list-item-title" style={{ color: 'var(--color-text)' }}>{account.name}</div>
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
                        {state.isLoading ? (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                                <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>⏳</div>
                                <div className="text-lg font-semibold mb-sm">Processing PDF...</div>
                                <div className="text-secondary text-sm">Extracting transactions from your statement</div>
                            </div>
                        ) : (
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
                        )}

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
                            disabled={state.isLoading}
                        >
                            ← Back to accounts
                        </button>
                    </div>
                )}

                {/* Step: Preview */}
                {state.step === 'preview' && (
                    <div>
                        {/* Summary and Balance - horizontal row, wraps on mobile */}
                        <div className="flex gap-sm mb-lg" style={{ flexWrap: 'wrap' }}>
                            {/* Summary */}
                            <div className="card" style={{ flex: '1 1 150px', minWidth: '150px' }}>
                                <div className="flex justify-between mb-sm" style={{ gap: 'var(--space-sm)' }}>
                                    <span className="text-secondary text-sm">File</span>
                                    <div className="import-filename">
                                        <span className="font-medium text-sm">
                                            {state.file?.name}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-secondary text-sm">New</span>
                                    <span className="font-medium text-income text-sm">{state.parsedTransactions.length}</span>
                                </div>
                                {state.duplicateCount > 0 && (
                                    <div className="flex justify-between mt-sm">
                                        <span className="text-secondary text-sm">Skipped</span>
                                        <span className="font-medium text-muted text-sm">{state.duplicateCount}</span>
                                    </div>
                                )}
                            </div>
                            {/* Balance */}
                            {state.closingBalance !== null && (
                                <div className="card" style={{ flex: '1 1 120px', minWidth: '120px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div className="text-secondary text-sm">Balance</div>
                                    <div className="font-semibold text-lg">
                                        ${state.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Transaction preview - scrollable */}
                        <div className="section-title mb-md">All transactions ({state.parsedTransactions.length})</div>
                        <div
                            className="list mb-lg"
                            style={{
                                maxHeight: '400px',
                                overflowY: 'auto',
                                border: '1px solid var(--color-bg-hover)',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            {state.parsedTransactions.map((t) => {
                                const isHighValue = Math.abs(t.amount) > 100;
                                return (
                                    <div
                                        key={t.id}
                                        className="card mb-sm"
                                        style={{
                                            padding: 'var(--space-md)',
                                            borderLeft: isHighValue ? '3px solid var(--color-warning)' : undefined,
                                            background: isHighValue ? 'rgba(251, 191, 36, 0.1)' : undefined,
                                        }}
                                    >
                                        <div className="import-row">
                                            {/* Left Column: Info */}
                                            <div className="import-info">
                                                <div className="import-description" style={{ wordBreak: 'break-word', marginBottom: '2px' }}>
                                                    {t.description}
                                                </div>
                                                <div className="flex justify-between items-center" style={{ marginTop: '2px' }}>
                                                    <div className="import-date text-secondary">
                                                        {formatDate(t.date)}
                                                    </div>
                                                    <div
                                                        className={`import-amount font-semibold ${t.amount < 0 ? 'text-expense' : 'text-income'}`}
                                                    >
                                                        {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column: Controls */}
                                            <div className="import-controls">
                                                <select
                                                    value={t.type}
                                                    onChange={(e) => handleTransactionTypeChange(t.id, e.target.value as TransactionType)}
                                                    className="import-select"
                                                    style={{
                                                        padding: '4px 6px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--color-bg-hover)',
                                                        background: 'var(--color-bg-secondary)',
                                                        color: 'var(--color-text)',
                                                    }}
                                                >
                                                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                                                        <option key={value} value={value}>{label}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={t.category}
                                                    onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                                                    className="import-select"
                                                    style={{
                                                        padding: '4px 6px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--color-bg-hover)',
                                                        background: 'var(--color-bg-secondary)',
                                                        color: 'var(--color-text)',
                                                    }}
                                                >
                                                    {CATEGORIES.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
        </div >
    );
}
