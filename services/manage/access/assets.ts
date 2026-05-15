'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import prisma from '@/core/helpers/prisma';
import { Prisma } from '../../../prisma/generated/client/client';
import { getActiveAccountId } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';
import { checkPermissions, getAccountType } from '@/services/user';
import { resolveAssetName } from '@/services/manage/access/asset-resolvers';

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

const ACCESS_APP_ID = 'neup.account';

type AccessAssetGroup = Prisma.PortfolioGetPayload<{
  include: {
    members: true;
    assets: true;
  };
}>;

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
  const canView = await checkPermissions(['security.third_party.view']);
  if (!canView) return [];

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
export async function getAccessAssetGroup(groupId: string): Promise<AccessAssetGroup | null> {
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
  const canAdd = await checkPermissions(['security.third_party.add']);
  if (!canAdd) {
    return { success: false, error: 'Permission denied.' };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  // Portfolios can only be created by individual accounts.
  const accountType = await getAccountType(accountId);
  if (accountType !== 'individual') {
    return { success: false, error: 'Only individual accounts can create portfolios.' };
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

    // Prevent duplicate assets in the same portfolio
    const existing = await prisma.portfolioAsset.findFirst({
      where: {
        portfolioId: parsed.data.groupId,
        assetId: parsed.data.asset,
      },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: 'This asset is already in the portfolio.' };
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
 * Function removeAssetFromGroup.
 *
 * Removes an asset from a portfolio and cleans up all access grants scoped to
 * that asset within the portfolio. The asset is then re-attached to a personal
 * portfolio owned solely by the caller so it is not lost.
 */
export async function removeAssetFromGroup(input: { groupId: string; portfolioAssetId: string }) {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  if (!input.groupId || !input.portfolioAssetId) {
    return { success: false, error: 'Missing required fields.' };
  }

  try {
    const allowed = await canAccessGroup(input.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    // Load the asset row so we know assetId and assetType for re-attachment
    const assetRow = await prisma.portfolioAsset.findFirst({
      where: {
        id: input.portfolioAssetId,
        portfolioId: input.groupId,
      },
      select: { id: true, assetId: true, assetType: true },
    });

    if (!assetRow) {
      return { success: false, error: 'Asset not found in this portfolio.' };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Remove all access grants scoped to this asset in this portfolio
      await tx.authzAssetsAccessGrant.deleteMany({
        where: {
          asset_id: assetRow.id,
          portfolio_id: input.groupId,
        },
      });

      // 2. Remove the asset from the portfolio
      await tx.portfolioAsset.delete({
        where: { id: assetRow.id },
      });

      // 3. Re-attach the asset to the caller's personal portfolio.
      //    Find or create a personal portfolio owned solely by this account.
      let personalPortfolio = await tx.portfolio.findFirst({
        where: {
          members: {
            every: { accountId },
            some: { accountId },
          },
        },
        select: { id: true },
      });

      if (!personalPortfolio) {
        personalPortfolio = await tx.portfolio.create({
          data: {
            name: 'My Assets',
            description: 'Personal asset portfolio.',
            members: {
              create: {
                accountId,
                details: {
                  isPermanent: true,
                  hasFullAccess: true,
                },
              },
            },
          },
          select: { id: true },
        });
      }

      // Only add if not already present in the personal portfolio
      const alreadyInPersonal = await tx.portfolioAsset.findFirst({
        where: {
          portfolioId: personalPortfolio.id,
          assetId: assetRow.assetId,
        },
        select: { id: true },
      });

      if (!alreadyInPersonal) {
        await tx.portfolioAsset.create({
          data: {
            portfolioId: personalPortfolio.id,
            assetId: assetRow.assetId,
            assetType: assetRow.assetType,
          },
        });
      }
    });

    revalidatePath('/access');
    revalidatePath(`/access/portfolio/${input.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `removeAssetFromGroup:${input.groupId}:${input.portfolioAssetId}`);
    return { success: false, error: 'Failed to remove asset.' };
  }
}


/**
 * Function removeAssetGroupMember.
 *
 * Removes a member from a portfolio and cleans up all access grants they held
 * on assets within that portfolio.
 *
 * Security rules:
 * - The portfolio owner (the member with hasFullAccess: true in their details)
 *   cannot be removed by anyone. Portfolio ownership is permanent.
 */
export async function removeAssetGroupMember(input: {
  groupId: string;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  if (!input.groupId || !input.memberId) {
    return { success: false, error: 'Missing required fields.' };
  }

  try {
    const allowed = await canAccessGroup(input.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    const member = await prisma.portfolioMember.findFirst({
      where: {
        id: input.memberId,
        portfolioId: input.groupId,
      },
      select: { id: true, accountId: true, details: true },
    });

    if (!member) {
      return { success: false, error: 'Member not found in this portfolio.' };
    }

    // The portfolio owner (hasFullAccess: true) cannot be removed.
    const details = member.details as Record<string, unknown> | null;
    if (details?.hasFullAccess === true) {
      return { success: false, error: 'The portfolio owner cannot be removed.' };
    }

    await prisma.$transaction(async (tx) => {
      // Remove all access grants for this member in this portfolio
      await tx.authzAssetsAccessGrant.deleteMany({
        where: {
          account_id: member.accountId,
          portfolio_id: input.groupId,
          app_id: ACCESS_APP_ID,
        },
      });

      // Remove the member from the portfolio
      await tx.portfolioMember.delete({
        where: { id: member.id },
      });
    });

    revalidatePath('/access');
    revalidatePath(`/access/portfolio/${input.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `removeAssetGroupMember:${input.groupId}:${input.memberId}`);
    return { success: false, error: 'Failed to remove member.' };
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

    // Find or create the asset access grant
    const existing = await prisma.authzAssetsAccessGrant.findFirst({
      where: {
        asset_id: parsed.data.asset,
        account_id: member.accountId,
        role_id: parsed.data.role,
        portfolio_id: parsed.data.groupId,
        app_id: ACCESS_APP_ID,
      },
    });

    if (!existing) {
      await prisma.authzAssetsAccessGrant.create({
        data: {
          asset_id: parsed.data.asset,
          account_id: member.accountId,
          role_id: parsed.data.role,
          portfolio_id: parsed.data.groupId,
          app_id: ACCESS_APP_ID,
        },
      });
    }

    revalidatePath(`/access/${parsed.data.groupId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `assignAssetMemberRole:${input.groupId}`);
    return { success: false, error: 'Failed to assign role.' };
  }
}


/**
 * Type AssetRole — a role available for a specific asset type.
 */
export type AssetRole = {
  id: string;
  name: string;
  description?: string;
};

// Maps portfolioAsset.assetType values to the authzRole.scope used in the seeder.
const ASSET_TYPE_TO_ROLE_SCOPE: Record<string, string> = {
  application:     'application',
  app:             'application',
  brand_account:   'brand',
  branch_account:  'brand',
};

/**
 * Function getRolesForAsset.
 *
 * Given a portfolioAsset row ID, resolves the asset type and returns all
 * AuthzRole rows whose scope matches that asset type within neup.account.
 *
 * Roles are scoped by asset TYPE, not by the specific asset instance —
 * e.g. all application assets share the same set of application-scoped roles.
 */
export async function getRolesForAsset(portfolioAssetId: string): Promise<AssetRole[]> {
  if (!portfolioAssetId) return [];

  try {
    const assetRow = await prisma.portfolioAsset.findUnique({
      where: { id: portfolioAssetId },
      select: { assetType: true },
    });

    if (!assetRow) return [];

    const type = assetRow.assetType.trim().toLowerCase();
    const roleScope = ASSET_TYPE_TO_ROLE_SCOPE[type];

    if (!roleScope) return [];

    const roles = await prisma.authzRole.findMany({
      where: {
        appId: 'neup.account',
        scope: roleScope,
      },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
    }));
  } catch (error) {
    await logError('database', error, `getRolesForAsset:${portfolioAssetId}`);
    return [];
  }
}


/**
 * Function getRolesForAssetType.
 *
 * Returns all AuthzRole rows for a given asset type string (e.g. 'application', 'brand_account').
 * Used by the permission wizard to show available roles before assets are added to the portfolio.
 */
export async function getRolesForAssetType(assetType: string): Promise<AssetRole[]> {
  if (!assetType) return [];

  try {
    const type = assetType.trim().toLowerCase();
    const roleScope = ASSET_TYPE_TO_ROLE_SCOPE[type];

    if (!roleScope) return [];

    const roles = await prisma.authzRole.findMany({
      where: {
        appId: 'neup.account',
        scope: roleScope,
      },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
    }));
  } catch (error) {
    await logError('database', error, `getRolesForAssetType:${assetType}`);
    return [];
  }
}


/**
 * Function bulkAssignAssetRoles.
 *
 * Assigns multiple roles to a member across multiple assets in a single operation.
 * Used by the permission wizard after the user confirms their selections.
 */
export async function bulkAssignAssetRoles(input: {
  groupId: string;
  memberId: string;
  assetIds: string[];
  assetType: string;
  roleIds: string[];
}): Promise<{ success: boolean; error?: string; assigned?: number }> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not authenticated.' };
  }

  if (!input.groupId || !input.memberId || !input.assetIds.length || !input.roleIds.length) {
    return { success: false, error: 'Missing required fields.' };
  }

  try {
    const allowed = await canAccessGroup(input.groupId, accountId);
    if (!allowed) {
      return { success: false, error: 'Permission denied.' };
    }

    const member = await prisma.portfolioMember.findFirst({
      where: {
        id: input.memberId,
        portfolioId: input.groupId,
      },
      select: { id: true, accountId: true },
    });

    if (!member) {
      return { success: false, error: 'Member not found in this group.' };
    }

    // First, ensure all assets are in the portfolio
    const existingAssets = await prisma.portfolioAsset.findMany({
      where: {
        portfolioId: input.groupId,
        assetId: { in: input.assetIds },
      },
      select: { id: true, assetId: true },
    });

    const existingAssetIdMap = new Map(existingAssets.map((a) => [a.assetId, a.id]));
    const portfolioAssetIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Add missing assets to the portfolio (only if they don't exist)
      for (const assetId of input.assetIds) {
        if (existingAssetIdMap.has(assetId)) {
          portfolioAssetIds.push(existingAssetIdMap.get(assetId)!);
        } else {
          const created = await tx.portfolioAsset.create({
            data: {
              portfolioId: input.groupId,
              assetId,
              assetType: input.assetType,
            },
            select: { id: true },
          });
          portfolioAssetIds.push(created.id);
        }
      }

      // For each asset, update the grants: remove old roles, add new roles
      for (const portfolioAssetId of portfolioAssetIds) {
        // Remove all existing grants for this member on this asset in this portfolio
        await tx.authzAssetsAccessGrant.deleteMany({
          where: {
            asset_id: portfolioAssetId,
            account_id: member.accountId,
            portfolio_id: input.groupId,
            app_id: ACCESS_APP_ID,
          },
        });

        // Add the new role grants
        for (const roleId of input.roleIds) {
          await tx.authzAssetsAccessGrant.create({
            data: {
              asset_id: portfolioAssetId,
              account_id: member.accountId,
              role_id: roleId,
              portfolio_id: input.groupId,
              app_id: ACCESS_APP_ID,
            },
          });
        }
      }
    });

    const totalAssigned = portfolioAssetIds.length * input.roleIds.length;

    revalidatePath('/access');
    revalidatePath(`/access/portfolio/${input.groupId}`);
    return { success: true, assigned: totalAssigned };
  } catch (error) {
    await logError('database', error, `bulkAssignAssetRoles:${input.groupId}`);
    return { success: false, error: 'Failed to assign permissions.' };
  }
}


/**
 * Type MemberAssetGrant - represents existing grants for a member on an asset.
 */
export type MemberAssetGrant = {
  portfolioAssetId: string;
  assetId: string;
  assetName: string;
  assetType: string;
  roleIds: string[];
};

/**
 * Function getMemberAssetGrants.
 *
 * Returns all assets in the portfolio that the given member has access to,
 * along with the roles they hold on each asset.
 */
export async function getMemberAssetGrants(
  groupId: string,
  memberId: string,
): Promise<MemberAssetGrant[]> {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];

  try {
    const allowed = await canAccessGroup(groupId, accountId);
    if (!allowed) return [];

    const member = await prisma.portfolioMember.findFirst({
      where: {
        id: memberId,
        portfolioId: groupId,
      },
      select: { id: true, accountId: true },
    });

    if (!member) return [];

    // Get all grants for this member in this portfolio
    const grants = await prisma.authzAssetsAccessGrant.findMany({
      where: {
        account_id: member.accountId,
        portfolio_id: groupId,
        app_id: ACCESS_APP_ID,
      },
      select: {
        asset_id: true,
        role_id: true,
        asset: {
          select: {
            id: true,
            assetId: true,
            assetType: true,
          },
        },
      },
    });

    // Group by asset
    const assetMap = new Map<string, { portfolioAssetId: string; assetId: string; assetType: string; roleIds: string[] }>();

    for (const grant of grants) {
      const key = grant.asset_id;
      if (!assetMap.has(key)) {
        assetMap.set(key, {
          portfolioAssetId: grant.asset.id,
          assetId: grant.asset.assetId,
          assetType: grant.asset.assetType,
          roleIds: [],
        });
      }
      assetMap.get(key)!.roleIds.push(grant.role_id);
    }

    // Resolve asset names
    const results = await Promise.all(
      Array.from(assetMap.values()).map(async (item) => {
        const resolved = await resolveAssetName(item.assetId, item.assetType);
        return {
          portfolioAssetId: item.portfolioAssetId,
          assetId: item.assetId,
          assetName: resolved.name,
          assetType: item.assetType,
          roleIds: item.roleIds,
        };
      })
    );

    return results;
  } catch (error) {
    await logError('database', error, `getMemberAssetGrants:${groupId}:${memberId}`);
    return [];
  }
}
