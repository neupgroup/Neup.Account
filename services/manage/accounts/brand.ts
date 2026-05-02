'use server';

import prisma from '@/core/helpers/prisma';
import { checkPermissions, getUserProfile } from '@/core/helpers/user';
import { logError } from '@/core/helpers/logger';
import { switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction } from '@/core/auth/session';
import { getPersonalAccountId } from '@/core/auth/actions';
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { brandCreationSchema } from '@/services/manage/accounts/schema';
import { logActivity } from '@/core/helpers/log-actions';

export type BrandAccount = {
    id: string;
    name: string;
    logoUrl?: string;
    plan: string;
};

/**
 * Function getBrandAccounts.
 */
export async function getBrandAccounts(): Promise<BrandAccount[]> {
    const canView = await checkPermissions(['linked_accounts.brand.view']);
    if (!canView) return [];
    
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return [];
    }

    try {
        const ownerships = await prisma.accountOwnership.findMany({
            where: {
                parentId: personalAccountId,
                type: 'brand',
            },
            select: {
                childrenId: true,
            },
        });
        
        if (ownerships.length === 0) {
            return [];
        }

        const managedAccountIds = ownerships.map((ownership) => ownership.childrenId);

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


/**
 * Function createBrandAccount.
 */
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

        // Transaction to create everything
        await prisma.$transaction(async (tx) => {
             const account = await tx.account.create({
                data: {
                    accountType: 'brand',
                    status: 'active',
                    isVerified: false,
                    displayName: nameBrand,
                    displayImage: null,
                    details: {
                        nameLegal: nameLegal || null,
                        registrationId: registrationId || null,
                    },
                    
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
                    } : undefined,

                    brandProfile: {
                        create: {
                            brandName: nameBrand,
                            dateCreated: new Date(),
                            isLegalEntity: Boolean(nameLegal || registrationId),
                            originCountry: servingAreas || null,
                        }
                    },
                }
            });

            await tx.accountOwnership.create({
                data: {
                    parentId: creatorAccountId,
                    childrenId: account.id,
                    type: 'brand',
                }
            });

            await tx.permit.create({
                data: {
                    accountId: creatorAccountId,
                    targetAccountId: account.id,
                    forSelf: false,
                    isRoot: false,
                    permissions: ['independent.default'], // Founder gets default management permissions
                    restrictions: [],
                    createdOn: new Date()
                }
            });
        });
        
        await logActivity(creatorAccountId, `Created Brand Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/accounts/brand');

        return { success: true };

    } catch (error) {
        await logError('database', error, `createBrandAccount failed for neupId: ${neupId}`);
        return { success: false, error: 'An unexpected error occurred during brand account creation.' };
    }
}


/**
 * Function switchToBrand.
 */
export async function switchToBrand(brandId: string) {
    try {
        return await switchToBrandAction(brandId);
    } catch (error) {
        await logError('auth', error, `switchToBrand: ${brandId}`);
        return { success: false, error: 'Failed to switch to brand account.' };
    }
}


/**
 * Function switchToPersonal.
 */
export async function switchToPersonal() {
    try {
        await switchToPersonalAction();
    } catch (error) {
        await logError('auth', error, `switchToPersonal`);
    }
}