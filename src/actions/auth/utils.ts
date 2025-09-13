'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, type DocumentReference } from 'firebase/firestore';

const AUTH_REQUEST_EXPIRATION_MINUTES = 7;

export async function getAuthRequest(
  id: string
): Promise<{ data: any; ref: any } | null> {
  const authRequestRef = doc(db, 'auth_requests', id);
  const authRequestDoc = await getDoc(authRequestRef);

  if (
    !authRequestDoc.exists() ||
    (authRequestDoc.data().expiresAt && authRequestDoc.data().expiresAt.toDate() < new Date())
  ) {
    return null;
  }
  return { data: authRequestDoc.data(), ref: authRequestRef };
}

export async function extendAuthRequest(ref: DocumentReference) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
    await updateDoc(ref, { expiresAt });
}
