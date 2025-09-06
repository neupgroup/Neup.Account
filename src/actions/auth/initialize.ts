'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

const AUTH_REQUEST_EXPIRATION_MINUTES = 15;

export async function initializeSignup() {
  const requestId = uuidv4();
  const authRequestRef = doc(db, 'auth_requests', requestId);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);

  await setDoc(authRequestRef, {
    type: 'signup',
    status: 'pending_name',
    data: {},
    createdAt: serverTimestamp(),
    expiresAt: expiresAt,
  });

  await cookies().set('temp_auth_id', requestId, {
    httpOnly: true,
    secure: true,
    maxAge: AUTH_REQUEST_EXPIRATION_MINUTES * 60,
  });

  return { success: true, requestId };
}
