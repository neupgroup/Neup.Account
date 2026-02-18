
'use server';

import prisma from '@/lib/prisma';
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
  const count = await prisma.account.count();
  return count === 0;
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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    nameFirst,
    nameMiddle,
    nameLast
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_demographics',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    dateBirth: validation.data.dob,
    gender: finalGender,
    customGender: finalCustomGender ? sanitizeName(finalCustomGender) : null,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_nationality',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    nationality: validation.data.nationality,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_contact',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    phone: validation.data.phone,
    phoneVerified: true,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_neupid',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    phoneVerified: true,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_neupid',
    },
  });
  await extendAuthRequest(authRequestId);

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
  const existingNeupId = await prisma.neupId.findUnique({
    where: { id: neupId },
  });

  if (existingNeupId) {
    return { success: false, error: 'This NeupID is already taken.' };
  }

  const request = await getAuthRequest(authRequestId);
  if (!request)
    return { success: false, error: 'Signup session expired.' };

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    neupId: neupId,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_password',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const currentData = request.data.data as Record<string, any>;
  const newData = {
    ...currentData,
    password: hashedPassword,
  };

  await prisma.authRequest.update({
    where: { id: authRequestId },
    data: {
      data: newData,
      status: 'pending_terms',
    },
  });
  await extendAuthRequest(authRequestId);

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

  const requestData = request.data.data as Record<string, any>;

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
  } = requestData;

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

    const account = await prisma.account.create({
      data: {
        accountType: 'individual',
        accountStatus: 'active',
        verified: false,
        nameDisplay: nameDisplay,
        accountPhoto: null,
        nameFirst,
        nameLast,
        nameMiddle: nameMiddle || null,
        dateBirth: new Date(dateBirth),
        gender,
        // customGender: customGender || null, // customGender is not in schema yet, adding to block if needed or ignoring for now
        nationality,
        neupIdPrimary: neupId,
        dateCreated: new Date(),
        
        neupIds: {
          create: {
            id: neupId,
            isPrimary: true,
          },
        },
        
        password: {
            create: {
                hash: password,
                passwordLastChanged: new Date(),
            }
        },

        contacts: {
          create: {
            contactType: 'primaryPhone',
            value: phone,
          },
        },
      },
    });

    const accountId = account.id;

    // Permissions
    const permissionSet = await prisma.permission.findUnique({
      where: { name: permissionSetName },
    });

    if (permissionSet) {
      await prisma.permit.create({
        data: {
          accountId: accountId,
          forSelf: !isAdmin,
          isRoot: isAdmin,
          permissions: [permissionSet.id],
          restrictions: [],
          createdOn: new Date(),
        },
      });
    }

    await logActivity(
      accountId,
      'User Registration',
      'Success',
      ipAddress
    );
    await createAndSetSession(accountId, 'Registration', ipAddress, userAgent);

    // Mark the auth request as completed
    await prisma.authRequest.update({
        where: { id: authRequestId },
        data: { status: 'completed' }
    });

    return { success: true };
  } catch (error) {
    await logError('database', error, 'submitTermsStep');
    return {
      success: false,
      error: 'An unexpected error occurred during registration.',
    };
  }
}
