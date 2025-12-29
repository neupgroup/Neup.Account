
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
import { getAuthRequest, extendAuthRequest } from './utils';
import {
  nameSchema,
  demographicsSchema,
  nationalitySchema,
  contactSchema,
  otpSchema,
  neupidSchema,
  passwordSchema,
  termsSchema,
} from '@/schemas/signup';

// Helper to sanitize name fields
const sanitizeName = (name: string | undefined | null): string => {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ');
};


async function isFirstUser() {
  const accountsCollection = collection(db, 'account');
  const accountsSnapshot = await getDocs(query(accountsCollection, limit(1)));
  return accountsSnapshot.empty;
}

export async function getSignupStepData(authRequestId: string) {
  if (!authRequestId) {
    return { success: false, data: null };
  }
  const request = await getAuthRequest(authRequestId);
  if (!request) {
    return { success: false, data: null };
  }
  return { success: true, data: request.data.data };
}

export async function submitNameStep(authRequestId: string, data: z.infer<typeof nameSchema>) {
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

  const nameFirst = sanitizeName(validation.data.firstName);
  const nameMiddle = sanitizeName(validation.data.middleName);
  const nameLast = sanitizeName(validation.data.lastName);

  await updateDoc(request.ref, {
    'data.nameFirst': nameFirst,
    'data.nameMiddle': nameMiddle,
    'data.nameLast': nameLast,
    status: 'pending_demographics',
  });
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitDemographicsStep(authRequestId: string, data: z.infer<typeof demographicsSchema>) {
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
  let finalCustomGender = validation.data.customGender;

  if (finalGender === 'custom' && (!finalCustomGender || finalCustomGender.trim() === '')) {
    finalGender = 'prefer_not_to_say';
    finalCustomGender = undefined;
  }

  await updateDoc(request.ref, {
    'data.dateBirth': validation.data.dob,
    'data.gender': finalGender,
    'data.customGender': finalCustomGender ? sanitizeName(finalCustomGender) : null,
    status: 'pending_nationality',
  });
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitNationalityStep(authRequestId: string, data: z.infer<typeof nationalitySchema>) {
  if (!authRequestId)
    return { success: false, error: 'Signup session not found.' };

  const validation = nationalitySchema.safeParse(data);
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
    'data.nationality': validation.data.nationality,
    status: 'pending_contact',
  });
  await extendAuthRequest(request.ref);

  return { success: true };
}


export async function submitContactStep(authRequestId: string, data: z.infer<typeof contactSchema>) {
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

  // Skip OTP verification - directly mark phone as verified
  console.log(`Phone number saved: ${validation.data.phone} (OTP verification skipped)`);

  await updateDoc(request.ref, {
    'data.phone': validation.data.phone,
    'data.phoneVerified': true,
    status: 'pending_neupid',
  });
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitOtpStep(authRequestId: string, data: z.infer<typeof otpSchema>) {
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
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitNeupIdStep(authRequestId: string, data: z.infer<typeof neupidSchema>) {
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
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitPasswordStep(authRequestId: string, data: z.infer<typeof passwordSchema>) {
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
  await extendAuthRequest(request.ref);

  return { success: true };
}

export async function submitTermsStep(authRequestId: string, data: z.infer<typeof termsSchema>) {
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
    nameFirst,
    nameLast,
    nameMiddle,
    dateBirth,
    gender,
    customGender,
    nationality,
    phone,
    neupId,
    password,
  } = request.data.data;

  const nameDisplay = [nameFirst, nameMiddle, nameLast].filter(Boolean).join(' ');

  if (
    !nameFirst ||
    !nameLast ||
    !dateBirth ||
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

    batch.set(newAccountRef, {
      accountType: 'individual',
      accountStatus: 'active',
      verified: false,
      nameDisplay: nameDisplay,
      accountPhoto: null,
      nameFirst,
      nameLast,
      nameMiddle: nameMiddle || null,
      dateBirth: dateBirth,
      gender,
      customGender: customGender || null,
      nationality,
      neupIdPrimary: neupId,
      dateCreated: serverTimestamp(),
    });

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

    // Mark the auth request as completed
    await updateDoc(request.ref, { status: 'completed' });

    return { success: true };
  } catch (error) {
    await logError('database', error, 'submitTermsStep');
    return {
      success: false,
      error: 'An unexpected error occurred during registration.',
    };
  }
}
