'use server';

import prisma from '@/core/helpers/prisma';

const AUTH_REQUEST_EXPIRATION_MINUTES = 7;

export async function getAuthRequest(
  id: string
) {
  const authRequest = await prisma.authRequest.findUnique({
    where: { id: id },
  });

  if (
    !authRequest ||
    (authRequest.expiresAt && authRequest.expiresAt < new Date())
  ) {
    return null;
  }
  return { data: authRequest, id: authRequest.id };
}

export async function extendAuthRequest(id: string) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
    await prisma.authRequest.update({
        where: { id: id },
        data: { expiresAt: expiresAt }
    });
}
