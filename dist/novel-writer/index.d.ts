/**
 * AI Novel Writer - Main entry point
 */
export default function handler(args: {
    command: string;
    args: string[];
    text?: string;
}): Promise<void>;
