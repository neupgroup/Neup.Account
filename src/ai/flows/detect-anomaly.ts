// This file uses server-side code.
'use server';

/**
 * @fileOverview An AI agent that detects anomalous account updates.
 *
 * - detectAccountUpdateAnomaly - A function that detects anomalies in account updates.
 * - DetectAccountUpdateAnomalyInput - The input type for the detectAccountUpdateAnomaly function.
 * - DetectAccountUpdateAnomalyOutput - The return type for the detectAccountUpdateAnomaly function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectAccountUpdateAnomalyInputSchema = z.object({
  accountUpdateDetails: z
    .string()
    .describe('Details of the account update, including fields changed and their previous/new values.'),
  userActivityLog: z
    .string()
    .describe('A log of recent user activity, including logins, updates, and permission changes.'),
});
export type DetectAccountUpdateAnomalyInput = z.infer<
  typeof DetectAccountUpdateAnomalyInputSchema
>;

const DetectAccountUpdateAnomalyOutputSchema = z.object({
  isAnomalous: z
    .boolean()
    .describe(
      'Whether the account update is considered anomalous based on the provided details and user activity log.'
    ),
  anomalyExplanation: z
    .string()
    .describe(
      'Explanation of why the account update is considered anomalous, if applicable.'
    ),
});
export type DetectAccountUpdateAnomalyOutput = z.infer<
  typeof DetectAccountUpdateAnomalyOutputSchema
>;

export async function detectAccountUpdateAnomaly(
  input: DetectAccountUpdateAnomalyInput
): Promise<DetectAccountUpdateAnomalyOutput> {
  return detectAccountUpdateAnomalyFlow(input);
}

const detectAccountUpdateAnomalyPrompt = ai.definePrompt({
  name: 'detectAccountUpdateAnomalyPrompt',
  input: {schema: DetectAccountUpdateAnomalyInputSchema},
  output: {schema: DetectAccountUpdateAnomalyOutputSchema},
  prompt: `You are a security expert tasked with detecting anomalous account updates.

  Based on the account update details and user activity log provided, determine if the account update is anomalous.
  Provide a detailed explanation of why the update is considered anomalous or not.

  Account Update Details: {{{accountUpdateDetails}}}
  User Activity Log: {{{userActivityLog}}}

  Consider factors such as:
  - Unusual changes to sensitive fields (e.g., email, phone number, address).
  - Changes in permissions or roles that deviate from the user's typical behavior.
  - Account updates occurring after suspicious activity (e.g., failed login attempts).
  - Updates that contradict established user behavior patterns.

  Set the isAnomalous field to true if the update is considered anomalous, and provide an explanation in the anomalyExplanation field. Otherwise, set isAnomalous to false and provide a reason why the update is not considered anomalous.
  {
    "isAnomalous": false,
    "anomalyExplanation": "The account update is not considered anomalous."
  }`,
});

const detectAccountUpdateAnomalyFlow = ai.defineFlow(
  {
    name: 'detectAccountUpdateAnomalyFlow',
    inputSchema: DetectAccountUpdateAnomalyInputSchema,
    outputSchema: DetectAccountUpdateAnomalyOutputSchema,
  },
  async input => {
    const {output} = await detectAccountUpdateAnomalyPrompt(input);
    return output!;
  }
);

