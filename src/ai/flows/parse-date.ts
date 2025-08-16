'use server';
/**
 * @fileOverview An AI agent that parses natural language dates.
 *
 * - parseDate - A function that parses a date string.
 * - ParseDateOutput - The return type for the parseDate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ParseDateInputSchema = z.object({
    dateString: z.string().describe('A date described in natural language or a specific format.'),
});

const ParseDateOutputSchema = z.object({
  parsedDate: z.string().describe("The parsed date in 'YYYY-MM-DD' format. If the input is not a valid or parsable date, this should be the string 'invalid'."),
});
export type ParseDateOutput = z.infer<typeof ParseDateOutputSchema>;

export async function parseDate(dateString: string): Promise<ParseDateOutput> {
    return parseDateFlow({dateString});
}

const parseDatePrompt = ai.definePrompt({
    name: 'parseDatePrompt',
    input: {schema: ParseDateInputSchema},
    output: {schema: ParseDateOutputSchema},
    prompt: `You are an expert multicultural date parser. Your task is to analyze the user's input string and convert it into a strict 'YYYY-MM-DD' format in the Gregorian calendar.

You must be able to handle various formats, including:
- Natural language (e.g., "june 12 2002", "tomorrow", "next friday").
- Common Gregorian formats (e.g., "YYYY/MM/DD", "MM-DD-YYYY").
- Dates from other calendar systems, such as the Nepali Bikram Sambat calendar. For example, "2058 magh 13" should be correctly converted to its Gregorian equivalent.

If the input string is ambiguous, not a date, or cannot be reliably parsed into a Gregorian 'YYYY-MM-DD' format, you MUST set the parsedDate field to the exact string 'invalid'.

Input date string: {{{dateString}}}`,
});

const parseDateFlow = ai.defineFlow(
    {
        name: 'parseDateFlow',
        inputSchema: ParseDateInputSchema,
        outputSchema: ParseDateOutputSchema,
    },
    async (input) => {
        const {output} = await parseDatePrompt(input);
        return output!;
    }
);
