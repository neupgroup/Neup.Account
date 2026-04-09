const AI_TEXT_ENDPOINT = 'https://neupgroup.com/cloud/bridge/api.v1/getResponse?type=text';

/**
 * Type AITextResponsePayload.
 */
export type AITextResponsePayload = {
  context: unknown;
  query?: string;
};

const DEFAULT_QUERY = 'convert to date in YYYY-MM-DD';


/**
 * Function extractTextFromResponse.
 */
function extractTextFromResponse(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.response,
    record.result,
    record.output,
    record.text,
    record.data,
    record.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}


/**
 * Function getAITextResponse.
 */
export async function getAITextResponse({
  context,
  query = DEFAULT_QUERY,
}: AITextResponsePayload): Promise<string> {
  const response = await fetch(AI_TEXT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context,
      query,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`AI API request failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const text = extractTextFromResponse(json);

  if (!text) {
    throw new Error('AI API did not return a text response');
  }

  return text;
}
