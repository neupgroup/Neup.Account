'use server';

import prisma from '@/lib/prisma';
import { checkPermissions, getUserProfile } from '@/lib/user';
import { logError } from '@/lib/logger';
import { switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction } from '@/lib/session';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { brandCreationSchema } from '@/schemas/auth';
import type { BrandAccount } from '@/types';
import { logActivity } from '@/lib/log-actions';

export async function getBrandAccounts(): Promise<BrandAccount[]> {
    const canView = await checkPermissions(['linked_accounts.brand.view']);
    if (!canView) return [];
    
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return [];
    }

    try {
        const permits = await prisma.permit.findMany({
            where: {
                accountId: personalAccountId,
                forSelf: false,
                isRoot: false
            }
        });
        
        if (permits.length === 0) {
            return [];
        }

        const managedAccountIds = permits
            .map(permit => permit.targetAccountId)
            .filter((id): id is string => !!id);

        if (managedAccountIds.length === 0) {
            return [];
        }

        const brandAccountsData = await prisma.account.findMany({
            where: {
                id: { in: managedAccountIds },
                accountType: 'brand'
            }
        });

        if (brandAccountsData.length === 0) {
            return [];
        }

        const brandAccounts = await Promise.all(
            brandAccountsData.map(async (account) => {
                const brandAccountId = account.id;
                // We can use the account data directly or call getUserProfile if it adds more logic
                const profile = await getUserProfile(brandAccountId);

                if (!profile) return null;

                return {
                    id: brandAccountId,
                    name: profile.nameDisplay || 'Unnamed Brand',
                    logoUrl: profile.accountPhoto,
                    plan: "Business" // Placeholder for plan
                };
            })
        );
        
        return brandAccounts.filter((account): account is NonNullable<typeof account> => account !== null);

    } catch (error) {
        await logError('database', error, 'getBrandAccounts');
        return [];
    }
}

export async function createBrandAccount(data: z.infer<typeof brandCreationSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.brand.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a brand account." };
    }
    
    const creatorAccountId = await getPersonalAccountId();
    if (!creatorAccountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = brandCreationSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { nameBrand, nameLegal, registrationId, headOfficeLocation, servingAreas } = validation.data;
    const neupId = validation.data.neupId.toLowerCase();
    const ipAddress = (await headers()).get('x-forwarded-for') || 'Unknown IP';

    try {
        const existingNeupId = await prisma.neupId.findUnique({
            where: { id: neupId }
        });
        
        if (existingNeupId) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        // Grant management permission to the creator by creating a permit document
        const brandAdminPerm = await prisma.permission.findUnique({
            where: { name: 'brand.founder' }
        });
        
        if (!brandAdminPerm) {
            await logError('database', new Error('brand.founder permission set not found'), 'createBrandAccount');
            return { success: false, error: 'Could not assign default management permissions. Please contact support.' };
        }

        // Transaction to create everything
        await prisma.$transaction(async (tx) => {
             const account = await tx.account.create({
                data: {
                    accountType: 'brand',
                    accountStatus: 'active',
                    verified: false,
                    nameDisplay: nameBrand,
                    // nameBrand: nameBrand, // nameBrand is not in schema, mapping to nameDisplay or nameLegal if needed, or adding to schema. 
                    // Assuming nameDisplay is enough for now, or nameLegal. 
                    // Wait, schema has nameLegal. 
                    nameLegal: nameLegal || null,
                    registrationId: registrationId || null,
                    // servingAreas: servingAreas || null, // servingAreas is not in schema.
                    dateCreated: new Date(),
                    
                    neupIds: {
                        create: {
                            id: neupId,
                            isPrimary: true
                        }
                    },
                    
                    contacts: headOfficeLocation ? {
                        create: {
                            contactType: 'headOfficeLocation',
                            value: headOfficeLocation
                        }
                    } : undefined
                }
            });

            await tx.permit.create({
                data: {
                    accountId: creatorAccountId,
                    targetAccountId: account.id,
                    forSelf: false,
                    isRoot: false,
                    // full_access: true, // Not in schema, relying on permissions list
                    permissions: [brandAdminPerm.id],
                    restrictions: [],
                    // status: 'approved', // Not in schema
                    createdOn: new Date()
                }
            });
        });
        
        await logActivity(creatorAccountId, `Created Brand Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/manage/accounts/brand');

        return { success: true };

    } catch (error) {
        await logError('database', error, `createBrandAccount failed for neupId: ${neupId}`);
        return { success: false, error: 'An unexpected error occurred during brand account creation.' };
    }
}


export async function switchToBrand(brandId: string) {
    try {
        return await switchToBrandAction(brandId);
    } catch (error) {
        await logError('auth', error, `switchToBrand: ${brandId}`);
        return { success: false, error: 'Failed to switch to brand account.' };
    }
}

export async function switchToPersonal() {
    try {
        await switchToPersonalAction();
    } catch (error) {
        await logError('auth', error, `switchToPersonal`);
    }
}