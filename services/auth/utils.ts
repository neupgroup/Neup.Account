'use server';

import prisma from '@/core/helpers/prisma';

const AUTH_REQUEST_EXPIRATION_MINUTES = 7;

// Terminal statuses — requests in these states cannot be used again.
const TERMINAL_STATUSES = new Set(['completed', 'used', 'cancelled', 'expired']);

type GetAuthRequestOptions = {
  expectedType?: string;
  expectedStatuses?: string[];
};

// Fetches an auth request by ID and validates it is not expired or in a terminal state.
// Optionally validates the request type and restricts to specific allowed statuses.
// Returns null if the request is missing, expired, terminal, or fails any constraint.
export async function getAuthRequest(id: string, options: GetAuthRequestOptions = {}) {
  const authRequest = await prisma.authRequest.findUnique({
    where: { id },
  });

  if (!authRequest) return null;

  // Reject if past the expiry timestamp
  if (authRequest.expiresAt && authRequest.expiresAt < new Date()) return null;

  // Reject if in a terminal state
  if (TERMINAL_STATUSES.has(authRequest.status)) return null;

  // Reject if the type doesn't match the expected type
  if (options.expectedType && authRequest.type !== options.expectedType) return null;

  // Reject if the status is not in the allowed set
  if (options.expectedStatuses && !options.expectedStatuses.includes(authRequest.status)) return null;

  return { data: authRequest, id: authRequest.id };
}


// Extends the expiry of an auth request by AUTH_REQUEST_EXPIRATION_MINUTES from now.
export async function extendAuthRequest(id: string) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
  await prisma.authRequest.update({
    where: { id },
    data: { expiresAt },
  });
}
