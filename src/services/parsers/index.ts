import type { Account } from '@/models';
import { parseUOBOneStatement, ParsedStatement } from './uobOneParser';
import { parseUOBLadyStatement } from './uobLadyParser';
import { parseUOBCreditCardStatement } from './uobCreditCardParser';

export { parseUOBOneStatement, parseUOBLadyStatement, parseUOBCreditCardStatement };
export type { ParsedStatement };

import type { PDFLine } from '@/utils/pdfExtractor';

// Standard Input for all parsers
export interface ParserInput {
    text: string;
    lines?: PDFLine[];
}

// Parser Registry definition
interface ParserConfig {
    institution: string;
    accountName: string; // Exact match or strict identifier
    parser: (input: ParserInput) => ParsedStatement;
}

const PARSER_REGISTRY: ParserConfig[] = [
    {
        institution: 'UOB',
        accountName: 'UOB Lady\'s Savings',
        parser: parseUOBLadyStatement
    },
    {
        institution: 'UOB',
        accountName: 'UOB One (with FX+)',
        parser: parseUOBOneStatement
    },
    {
        institution: 'UOB',
        accountName: 'UOB Credit Card',
        parser: parseUOBCreditCardStatement
    }
];

export function getParser(account: Account): (input: ParserInput) => ParsedStatement {
    const match = PARSER_REGISTRY.find(config =>
        config.institution === account.institution &&
        config.accountName === account.name
    );

    if (match) {
        return match.parser;
    }

    // Default Fallback (Legacy support or unknown new accounts)
    // Warn if no strict match found?
    console.warn(`No strict parser match for ${account.institution} - ${account.name}. Defaulting to UOB One.`);
    return parseUOBOneStatement;
}
