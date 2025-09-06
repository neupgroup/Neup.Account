
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  limit,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { createAndSetSession } from '@/lib/session';
import { logError } from '@/lib/logger';
import type { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import {
  nameSchema,
  demographicsSchema,
  contactSchema,
  otpSchema,
  neupidSchema,
  passwordSchema,
  termsSchema,
} from '@/schemas/signup';

const AUTH_REQUEST_EXPIRATION_MINUTES = 15;

async function isFirstUser() {
  const accountsCollection = collection(db, 'account');
  const accountsSnapshot = await getDocs(query(accountsCollection, limit(1)));
  return accountsSnapshot.empty;
}

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

  cookies().set('auth_request_id', requestId, {
    httpOnly: true,
    secure: true,
    maxAge: AUTH_REQUEST_EXPIRATION_MINUTES * 60,
  });

  return { success: true, requestId };
}

async function getAuthRequest(
  id: string
): Promise<{ data: any; ref: any } | null> {
  const authRequestRef = doc(db, 'auth_requests', id);
  const authRequestDoc = await getDoc(authRequestRef);

  if (
    !authRequestDoc.exists() ||
    authRequestDoc.data().expiresAt.toDate() < new Date()
  ) {
    cookies().delete('auth_request_id');
    return null;
  }
  return { data: authRequestDoc.data(), ref: authRequestRef };
}

export async function getSignupStepData() {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId) {
    return { success: false, data: null };
  }
  const request = await getAuthRequest(authRequestId);
  if (!request) {
    return { success: false, data: null };
  }
  return { success: true, data: request.data.data };
}

export async function submitNameStep(data: z.infer<typeof nameSchema>) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = nameSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  await updateDoc(request.ref, {
    'data.firstName': validation.data.firstName,
    'data.middleName': validation.data.middleName,
    'data.lastName': validation.data.lastName,
    status: 'pending_demographics',
  });

  return { success: true };
}

export async function submitDemographicsStep(
  data: z.infer<typeof demographicsSchema>
) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = demographicsSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  let finalGender = validation.data.gender;
  if (validation.data.gender === 'custom') {
    finalGender = `c.${validation.data.customGender?.trim() || 'custom'}`;
  }

  await updateDoc(request.ref, {
    'data.dob': validation.data.dob,
    'data.gender': finalGender,
    'data.nationality': validation.data.nationality,
    status: 'pending_contact',
  });

  return { success: true };
}

export async function submitContactStep(data: z.infer<typeof contactSchema>) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = contactSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  // TODO: Send OTP logic here
  console.log(`Sending OTP to ${validation.data.phone}`);

  await updateDoc(request.ref, {
    'data.phone': validation.data.phone,
    status: 'pending_otp',
  });

  return { success: true };
}

export async function submitOtpStep(data: z.infer<typeof otpSchema>) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = otpSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  // TODO: Verify OTP logic here
  if (validation.data.code !== '123456') {
    return { success: false, error: 'Invalid OTP code.' };
  }

  await updateDoc(request.ref, {
    'data.phoneVerified': true,
    status: 'pending_neupid',
  });

  return { success: true };
}

export async function submitNeupIdStep(data: z.infer<typeof neupidSchema>) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = neupidSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const neupId = validation.data.neupId.toLowerCase();
  const neupidRef = doc(db, 'neupid', neupId);
  const neupidDoc = await getDoc(neupidRef);
  if (neupidDoc.exists()) {
    return { success: false, error: 'This NeupID is already taken.' };
  }

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  await updateDoc(request.ref, {
    'data.neupId': neupId,
    status: 'pending_password',
  });

  return { success: true };
}

export async function submitPasswordStep(
  data: z.infer<typeof passwordSchema>
) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = passwordSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'Invalid data.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  const hashedPassword = await bcrypt.hash(validation.data.password, 10);

  await updateDoc(request.ref, {
    'data.password': hashedPassword,
    status: 'pending_terms',
  });

  return { success: true };
}

export async function submitTermsStep(data: z.infer<typeof termsSchema>) {
  const authRequestId = cookies().get('auth_request_id')?.value;
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = termsSchema.safeParse(data);
  if (!validation.success)
    return {
      success: false,
      error: 'You must agree to the terms.',
      details: validation.error.flatten(),
    };

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  const {
    firstName,
    lastName,
    middleName,
    dob,
    gender,
    nationality,
    phone,
    neupId,
    password,
  } = request.data.data;

  if (
    !firstName ||
    !lastName ||
    !dob ||
    !gender ||
    !nationality ||
    !phone ||
    !neupId ||
    !password
  ) {
    return {
      success: false,
      error: 'Incomplete signup data. Please start over.',
    };
  }

  const headersList = await headers();
  const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
  const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

  try {
    const isAdmin = await isFirstUser();
    const permissionSetName = isAdmin ? 'root.whole' : 'individual.default';
    const batch = writeBatch(db);
    const newAccountRef = doc(collection(db, 'account'));
    const accountId = newAccountRef.id;

    batch.set(newAccountRef, { type: 'individual' });

    const permQuery = query(
      collection(db, 'permission'),
      where('name', '==', permissionSetName),
      limit(1)
    );
    const permSnap = await getDocs(permQuery);
    if (!permSnap.empty) {
      const permId = permSnap.docs[0].id;
      const newPermitRef = doc(collection(db, 'permit'));
      batch.set(newPermitRef, {
        account_id: accountId,
        for_self: !isAdmin,
        is_root: isAdmin,
        permission: [permId],
        restrictions: [],
        created_on: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'neupid', neupId), {
      for: accountId,
      is_primary: true,
    });
    batch.set(doc(db, 'auth_password', accountId), {
      pass: password,
      passwordLastChanged: serverTimestamp(),
    });
    batch.set(doc(db, 'profile', accountId), {
      firstName,
      lastName,
      middleName: middleName || '',
      dob,
      gender,
      nationality,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'contact', `primaryPhone_${accountId}`), {
      account_id: accountId,
      contact_type: 'primaryPhone',
      value: phone,
    });

    await batch.commit();

    await logActivity(
      accountId,
      'User Registration',
      'Success',
      ipAddress
    );
    await createAndSetSession(accountId, 'Registration', ipAddress, userAgent);

    // Delete the auth request
    await updateDoc(request.ref, { status: 'completed' });
    cookies().delete('auth_request_id');

    return { success: true };
  } catch (error) {
    await logError('database', error, 'submitTermsStep');
    return {
      success: false,
      error: 'An unexpected error occurred during registration.',
    };
  }
}
