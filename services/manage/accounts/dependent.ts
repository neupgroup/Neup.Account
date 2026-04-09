'use server';

import { z } from 'zod';
import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { dependentFormSchema } from '@/services/manage/accounts/schema';
import { checkPermissions, getUserProfile, getUserNeupIds } from '@/core/helpers/user';


export type DependentAccount = {
    id: string;
    nameDisplay?: string;
    neupId?: string;
    accountPhoto?: string;
};

export async function getDependentAccounts(): Promise<DependentAccount[]> {
    const canView = await checkPermissions(['linked_accounts.dependent.view']);
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

        const dependentAccountIds = permits
            .map(permit => permit.targetAccountId)
            .filter((id): id is string => !!id);

        if (dependentAccountIds.length === 0) {
            return [];
        }

        // Fetch account details for only those that are dependent accounts
        const dependentAccountsData = await prisma.account.findMany({
            where: {
                id: { in: dependentAccountIds },
                accountType: 'dependent'
            }
        });
        
        if (dependentAccountsData.length === 0) {
            return [];
        }
        
        const dependentAccounts = await Promise.all(
            dependentAccountsData.map(async (account) => {
                const accountId = account.id;
                const profile = await getUserProfile(accountId);

                if (!profile) return null;

                return {
                    id: accountId,
                    nameDisplay: profile.nameDisplay || `${profile.nameFirst} ${profile.nameLast}`.trim(),
                    neupId: profile.neupIdPrimary || 'N/A',
                    accountPhoto: profile.accountPhoto,
                };
            })
        );
        
        return dependentAccounts.filter((account): account is NonNullable<typeof account> => account !== null);

    } catch (error) {
        await logError('database', error, 'getDependentAccounts');
        return [];
    }
}


export async function createDependentAccount(data: z.infer<typeof dependentFormSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.dependent.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a dependent account." };
    }

    const guardianAccountId = await getPersonalAccountId();
    if (!guardianAccountId) {
        return { success: false, error: "Guardian not authenticated." };
    }

    const validation = dependentFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { password, agreement, ...profileData } = validation.data;
    const neupId = profileData.neupId.toLowerCase();
    const ipAddress = (await headers()).get('x-forwarded-for') || 'Unknown IP';

    try {
        const existingNeupId = await prisma.neupId.findUnique({
            where: { id: neupId }
        });
        
        if (existingNeupId) {
            return { success: false, error: 'This NeupID is already taken.' };
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const account = await prisma.account.create({
            data: {
                accountType: 'dependent',
                accountStatus: 'active',
                verified: false,
                nameDisplay: `${profileData.firstName} ${profileData.lastName}`.trim(),
                accountPhoto: null,
                neupIdPrimary: neupId,
                
                nameFirst: profileData.firstName,
                nameMiddle: profileData.middleName,
                nameLast: profileData.lastName,
                gender: profileData.gender,
                nationality: profileData.nationality,
                
                dateBirth: new Date(profileData.dob),
                dateCreated: new Date(),
                
                neupIds: {
                    create: {
                        id: neupId,
                        isPrimary: true
                    }
                },
                
                password: {
                    create: {
                        hash: hashedPassword,
                        passwordLastChanged: new Date()
                    }
                }
            }
        });
        
        const dependentAccountId = account.id;
        
        // Grant management permission to the guardian
        await prisma.permit.create({
            data: {
                accountId: guardianAccountId,
                targetAccountId: dependentAccountId,
                forSelf: false,
                isRoot: false,
                permissions: ['independent.default'], // Guardian gets default independent permissions over dependent
                restrictions: [],
                createdOn: new Date(),
            }
        });
        
        // Grant self-permissions to the dependent account
        await prisma.permit.create({
            data: {
                accountId: dependentAccountId,
                forSelf: true,
                isRoot: false,
                permissions: ['dependent.full'], // Dependent gets full dependent permissions for self
                restrictions: [],
                createdOn: new Date(),
            }
        });
        
        await logActivity(guardianAccountId, `Created Dependent Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/accounts/dependent');

        return { success: true, dependentId: dependentAccountId };

    } catch (error) {
        await logActivity('unknown', `Dependent account creation failed: ${neupId}`, 'Failed', ipAddress, guardianAccountId, geolocation);
        await logError('database', error, 'createDependentAccount');
        return { success: false, error: 'An unexpected error occurred during account creation.' };
    }
}