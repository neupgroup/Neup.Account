'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import prisma from '@/core/helpers/prisma';
import { getActiveAccountId } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';

const memberPattern = /^(account:)?[^\s:]+$/;

const createAssetGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required.').max(120, 'Group name is too long.'),
  details: z.string().trim().max(500, 'Details are too long.').optional().or(z.literal('')),
});

const addMemberSchema = z.object({
  groupId: z.string().min(1),
  member: z.string().trim().regex(memberPattern, 'Use account ID or account:<id>.'),
  isPermanent: z.boolean().default(false),
  validTill: z.date().optional(),
  hasFullPermit: z.boolean().default(false),
});

const addAssetSchema = z.object({
  groupId: z.string().min(1),
  asset: z.string().trim().min(1, 'Asset is required.').max(160, 'Asset is too long.'),
  type: z.string().trim().min(1, 'Type is required.').max(120, 'Type is too long.'),
  details: z.string().trim().max(500, 'Details are too long.').optional().or(z.literal('')),
});

const assignRoleSchema = z.object({
  groupId: z.string().min(1),
  assetMember: z.string().min(1),
  asset: z.string().min(1),
  role: z.string().trim().min(1, 'Role is required.').max(120, 'Role is too long.'),
});

/**
 * Function normalizeDetails.
 */
function normalizeDetails(value?: string): string | null {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : null;
}


/**
 * Function canAccessGroup.
 */
async function canAccessGroup(groupId: string, accountId: string): Promise<boolean> {
  const member = await prisma.portfolioMember.findFirst({
    where: {
      portfolioId: groupId,
      accountId,
    },
    select: { id: true },
  });

  return Boolean(member);
}


/**
 * Function getAccessAssetGroups.
 */
export async function getAccessAssetGroups() {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];

  try {
    return await prisma.portfolio.findMany({
      where: {
        members: {
          some: {
            accountId,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            assets: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  } catch (error) {
    await logError('database', error, 'getAccessAssetGroups');
    return [];
  }
}


/**
 * Function getAccessAssetGroup.
 */
export async function getAccessAssetGroup(groupId: string) {
  const accountId = await getActiveAccountId();
  if (!accountId) return null;

  try {
    const allowed = await canAccessGroup(groupId, accountId);
    if (!allowed) return null;

    return await prisma.portfolio.findUnique({
      where: { id: groupId },
      include: {
        members: {
          orderBy: {
            accountId: 'asc',
          },
        },
        assets: {
          orderBy: {
            assetId: 'asc',
          },
        },
        roles: {
          orderBy: {
            roleId: 'asc',
          },
        },
      },
    });
  } catch (error) {
    await logError('database', error, `getAccessAssetGroup:${groupId}`);
    return null;
  }
}


/**
 * Function createAssetGroup.
 */
export async function createAssetGroup(input: { name: string; details?: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  const parsed = createAssetGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors.name?.[0] || 'Invalid input.' };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.portfolio.create({
        data: {
          name: parsed.data.name,
          description: normalizeDetails(parsed.data.details),
        },
      });

      await tx.portfolioMember.create({
        data: {
          portfolioId: group.id,
          accountId,
          details: {
            isPermanent: true,
            hasFullAccess: true,
          },
        },
      });

      return group;
    });

    revalidatePath('/access');
    revalidatePath(`/access/${created.id}`);

    return { success: true, id: created.id };
  } catch (error) {
    await logError('database', error, 'createAssetGroup');
    return { success: false, error: 'Failed to create asset group.' };
  }
}


/**
 * Function addAssetGroupMember.
 */
export async function addAssetGroupMember(input: {
  groupId: string;
  member: string;
  isPermanent?: boolean;
  validTill?: string;
  hasFullPermit?: boolean;
}) {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  const validTillDate = input.validTill ? new Date(input.validTill) : undefined;

  const parsed = addMemberSchema.safeParse({
    groupId: input.groupId,
    member: input.member,
    isPermanent: Boolean(input.isPermanent),
    validTill: validTillDate,
    hasFullPermit: Boolean(input.hasFullPermit),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors.member?.[0] || 'Invalid member input.' };
  }

  if (!parsed.data.isPermanent && !parsed.data.validTill) {
    return { success: false, error: 'Set valid till date or mark as permanent.' };
  }

  try {
    const allowed = await canAccessGroup(parsed.data.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    const normalizedMemberId = parsed.data.member.startsWith('account:')
      ? parsed.data.member.slice('account:'.length)
      : parsed.data.member;

    await prisma.portfolioMember.create({
      data: {
        portfolioId: parsed.data.groupId,
        accountId: normalizedMemberId,
        details: {
          isPermanent: parsed.data.isPermanent,
          removesOn: parsed.data.isPermanent ? null : parsed.data.validTill || null,
          hasFullAccess: parsed.data.hasFullPermit,
        },
      },
    });

    revalidatePath('/access');
    revalidatePath(`/access/${parsed.data.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `addAssetGroupMember:${input.groupId}`);
    return { success: false, error: 'Failed to add member.' };
  }
}


/**
 * Function addAssetToGroup.
 */
export async function addAssetToGroup(input: { groupId: string; asset: string; type: string; details?: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  const parsed = addAssetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors.asset?.[0] || 'Invalid asset input.' };
  }

  try {
    const allowed = await canAccessGroup(parsed.data.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    await prisma.portfolioAsset.create({
      data: {
        portfolioId: parsed.data.groupId,
        assetId: parsed.data.asset,
        assetType: parsed.data.type,
        details: {
          note: normalizeDetails(parsed.data.details),
        },
      },
    });

    revalidatePath('/access');
    revalidatePath(`/access/${parsed.data.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `addAssetToGroup:${input.groupId}`);
    return { success: false, error: 'Failed to add asset.' };
  }
}


/**
 * Function assignAssetMemberRole.
 */
export async function assignAssetMemberRole(input: {
  groupId: string;
  assetMember: string;
  asset: string;
  role: string;
}) {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  const parsed = assignRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors.role?.[0] || 'Invalid role input.' };
  }

  try {
    const allowed = await canAccessGroup(parsed.data.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    const member = await prisma.portfolioMember.findFirst({
      where: {
        id: parsed.data.assetMember,
        portfolioId: parsed.data.groupId,
      },
      select: { id: true, accountId: true },
    });

    if (!member) {
      return { success: false, error: 'Member not found in this group.' };
    }

    await prisma.portfolioRole.upsert({
      where: {
        accountId_portfolioId_roleId: {
          accountId: member.accountId,
          portfolioId: parsed.data.groupId,
          roleId: parsed.data.role,
        },
      },
      create: {
        accountId: member.accountId,
        portfolioId: parsed.data.groupId,
        roleId: parsed.data.role,
        details: {},
      },
      update: {
        details: {},
      },
    });

    revalidatePath(`/access/${parsed.data.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `assignAssetMemberRole:${input.groupId}`);
    return { success: false, error: 'Failed to assign role.' };
  }
}
