import type { Transaction, TransactionType } from '@/models';

// Keywords for classifying transactions
const INCOME_KEYWORDS = [
    'salary',
    'payroll',
    'wages',
    'bonus',
    'commission',
    'freelance',
    'consulting',
];

const INVESTMENT_KEYWORDS = [
    'interest',
    'dividend',
    'coupon',
    'distribution',
    'yield',
    'capital gain',
];

const TRANSFER_PATTERNS = [
    // Credit card payments
    /credit card/i,
    /card payment/i,
    /pay(ment)? to.*card/i,
    // Internal transfers
    /transfer to/i,
    /transfer from/i,
    /internal transfer/i,
    // Brokerage funding
    /to.*brokerage/i,
    /from.*brokerage/i,
];

/**
 * Classify a transaction based on its description and patterns
 */
export function classifyTransaction(
    description: string,
    amount: number,
    sourceAccountType?: string,
    _targetAccountType?: string
): TransactionType {
    const lowerDesc = description.toLowerCase();

    // Check for transfers first (bank → credit/brokerage)
    if (sourceAccountType === 'bank') {
        for (const pattern of TRANSFER_PATTERNS) {
            if (pattern.test(description)) {
                return 'transfer';
            }
        }
    }

    // Check for income keywords
    for (const keyword of INCOME_KEYWORDS) {
        if (lowerDesc.includes(keyword)) {
            return 'income';
        }
    }

    // Check for investment income keywords
    for (const keyword of INVESTMENT_KEYWORDS) {
        if (lowerDesc.includes(keyword)) {
            return 'investment';
        }
    }

    // Default: positive = income, negative = expense
    // Most bank statements show expenses as negative
    if (amount > 0) {
        // Could be a refund or deposit - default to income
        // but user can reclassify
        return 'income';
    }

    return 'expense';
}

/**
 * Suggest a category based on description
 */
export function suggestCategory(description: string): string {
    const lowerDesc = description.toLowerCase();

    const categoryPatterns: [RegExp, string][] = [
        // Food & Dining
        [/restaurant|cafe|coffee|starbucks|mcdonald|grab food|foodpanda|deliveroo/i, 'Food & Dining'],
        [/supermarket|fairprice|cold storage|sheng siong|ntuc/i, 'Groceries'],

        // Transport
        [/grab|gojek|comfort|taxi|uber|mrt|bus|ez-?link/i, 'Transport'],
        [/petrol|gas|shell|esso|caltex|parking/i, 'Transport'],

        // Shopping
        [/amazon|lazada|shopee|qoo10|taobao/i, 'Online Shopping'],
        [/uniqlo|h&m|zara|cotton on/i, 'Clothing'],

        // Bills & Utilities
        [/singtel|starhub|m1|giga|sim only/i, 'Phone'],
        [/sp services|electricity|water|gas|utility/i, 'Utilities'],
        [/netflix|spotify|youtube|disney|hbo|subscription/i, 'Subscriptions'],

        // Housing
        [/rent|mortgage|hdb|condo|property/i, 'Housing'],
        [/insurance|prudential|aia|great eastern|ntuc income/i, 'Insurance'],

        // Health
        [/clinic|hospital|pharmacy|guardian|watsons|doctor|medical/i, 'Healthcare'],
        [/gym|fitness|activsg|anytime fitness/i, 'Fitness'],

        // Income
        [/salary|payroll|cpf|bonus/i, 'Salary'],
        [/interest|dividend/i, 'Investment Income'],
        [/refund|cashback/i, 'Refund'],
    ];

    for (const [pattern, category] of categoryPatterns) {
        if (pattern.test(lowerDesc)) {
            return category;
        }
    }

    return 'Other';
}

/**
 * Process raw transaction data and classify it
 */
export function processTransaction(
    id: string,
    date: string,
    description: string,
    amount: number,
    ownerId: string,
    accountId: string,
    sourceAccountType?: string
): Transaction {
    const type = classifyTransaction(description, amount, sourceAccountType);
    const category = suggestCategory(description);

    return {
        id,
        date,
        ownerId,
        accountId,
        type,
        category,
        amount: Math.abs(amount) * (type === 'expense' ? -1 : 1),
        description,
    };
}
