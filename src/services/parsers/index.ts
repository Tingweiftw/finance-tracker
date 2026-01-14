import type { Account } from '@/models';
import { parseUOBOneStatement, ParsedStatement } from './uobOneParser';
import { parseUOBLadyStatement } from './uobLadyParser';

export { parseUOBOneStatement, parseUOBLadyStatement };
export type { ParsedStatement };

// Parser Registry definition
interface ParserConfig {
    institution: string;
    accountName: string; // Exact match or strict identifier
    parser: (text: string) => ParsedStatement;
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
    }
];

export function getParser(account: Account): (text: string) => ParsedStatement {
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
