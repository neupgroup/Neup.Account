'use server';

import prisma from '@/core/helpers/prisma';
import { getUserProfile } from '@/services/user';
import { getPersonalAccountId, getActiveAccountId } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';

export type ResolvedAccount = {
  accountId: string;
  displayName: string;
};

export async function resolveNeupId(
  neupId: string,
): Promise<{ success: true; account: ResolvedAccount } | { success: false; error: string }> {
  const normalized = neupId.trim().toLowerCase();
  if (!normalized || normalized.length < 3) {
    return { success: false, error: 'NeupID must be at least 3 characters.' };
  }

  const record = await prisma.neupId.findUnique({
    where: { id: normalized },
    select: { accountId: true },
  });

  if (!record) {
    return { success: false, error: 'No account found with that NeupID.' };
  }

  const profile = await getUserProfile(record.accountId);
  const displayName =
    profile?.nameDisplay ||
    (profile?.nameFirst || profile?.nameLast
      ? `${profile.nameFirst ?? ''} ${profile.nameLast ?? ''}`.trim()
      : null) ||
    normalized;

  return {
    success: true,
    account: { accountId: record.accountId, displayName },
  };
}

// ── Selectable asset types ────────────────────────────────────────────────────

export type SelectableAsset = {
  /** The ID that goes into portfolioAsset.assetId */
  assetId: string;
  /** Human-readable name */
  name: string;
  /** The assetType string stored in portfolioAsset.assetType */
  assetType: string;
  /** Optional secondary label */
  subtitle?: string;
};

/**
 * Returns all brand accounts the personal user owns.
 */
async function getBrandAssets(): Promise<SelectableAsset[]> {
  try {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) return [];

    const grants = await prisma.authzAccountAccessGrant.findMany({
      where: {
        targetAccountId: personalAccountId,
        roleId: 'brand-owner-neup-account',
        appId: 'neup.account',
      },
      select: { ownerAccountId: true },
    });

    const ids = grants.map((g) => g.ownerAccountId);
    if (ids.length === 0) return [];

    const accounts = await prisma.account.findMany({
      where: { id: { in: ids }, accountType: 'brand' },
      select: { id: true, displayName: true },
    });

    return accounts.map((a) => ({
      assetId: a.id,
      name: a.displayName || 'Unnamed Brand',
      assetType: 'brand_account',
    }));
  } catch (error) {
    await logError('database', error, 'getBrandAssets');
    return [];
  }
}

/**
 * Returns all branch accounts under the currently active brand account.
 */
async function getBranchAssets(): Promise<SelectableAsset[]> {
  try {
    const activeAccountId = await getActiveAccountId();
    if (!activeAccountId) return [];

    // Branches are owned by the active brand account — find them via AccountOwnership
    // which maps parentId (brand) → childrenId (branch). Fall back to empty if table missing.
    const branches = await prisma.account.findMany({
      where: {
        accountType: 'branch',
        parentOwnerships: {
          some: { parentId: activeAccountId },
        },
      },
      include: { neupIds: { where: { isPrimary: true }, select: { id: true } } },
    });

    return branches.map((a) => ({
      assetId: a.id,
      name: a.displayName || 'Unnamed Branch',
      assetType: 'branch_account',
      subtitle: a.neupIds[0]?.id,
    }));
  } catch (error) {
    await logError('database', error, 'getBranchAssets');
    return [];
  }
}

/**
 * Returns all applications the active account owns.
 */
async function getApplicationAssets(): Promise<SelectableAsset[]> {
  try {
    const accountId = await getActiveAccountId();
    if (!accountId) return [];

    const grants = await prisma.authzAccountAccessGrant.findMany({
      where: { ownerAccountId: accountId, roleId: 'application.owner' },
      select: {
        application: { select: { id: true, name: true, status: true } },
      },
    });

    return grants.map((g) => ({
      assetId: g.application.id,
      name: g.application.name,
      assetType: 'application',
      subtitle: g.application.status ?? undefined,
    }));
  } catch (error) {
    await logError('database', error, 'getApplicationAssets');
    return [];
  }
}

export type AssetType = 'brand_account' | 'branch_account' | 'application';

export async function getSelectableAssets(
  type: AssetType,
  excludeAssetIds?: string[],
): Promise<SelectableAsset[]> {
  let assets: SelectableAsset[];
  switch (type) {
    case 'brand_account':
      assets = await getBrandAssets();
      break;
    case 'branch_account':
      assets = await getBranchAssets();
      break;
    case 'application':
      assets = await getApplicationAssets();
      break;
  }

  if (excludeAssetIds && excludeAssetIds.length > 0) {
    const excluded = new Set(excludeAssetIds);
    return assets.filter((a) => !excluded.has(a.assetId));
  }

  return assets;
}

// ── Member removal & invitation cancellation ──────────────────────────────────

import { revalidatePath } from 'next/cache';
import { logActivity } from '@/services/log-actions';
import { removeAssetGroupMember } from '@/services/manage/access/assets';

/**
 * Removes all direct (non-portfolio) access grants a member holds on the
 * active account, then revalidates the access pages.
 */
export async function removeDirectMember(
  memberAccountId: string,
): Promise<{ success: boolean; error?: string }> {
  const ownerAccountId = await getActiveAccountId();
  if (!ownerAccountId) return { success: false, error: 'Not authenticated.' };

  try {
    await prisma.authzAccountAccessGrant.deleteMany({
      where: {
        ownerAccountId,
        targetAccountId: memberAccountId,
        appId: 'neup.account',
        portfolioId: null,
      },
    });

    await logActivity(ownerAccountId, `Removed all direct access for ${memberAccountId}`, 'Completed');
    revalidatePath('/access');
    revalidatePath('/access/member');
    return { success: true };
  } catch (error) {
    await logError('database', error, `removeDirectMember:${memberAccountId}`);
    return { success: false, error: 'Failed to remove access.' };
  }
}

/**
 * Cancels a pending direct (non-portfolio) access invitation sent to a member.
 */
export async function cancelDirectInvitation(
  recipientAccountId: string,
): Promise<{ success: boolean; error?: string }> {
  const senderAccountId = await getActiveAccountId();
  if (!senderAccountId) return { success: false, error: 'Not authenticated.' };

  try {
    await prisma.request.deleteMany({
      where: {
        action: 'access_invitation',
        senderId: senderAccountId,
        recipientId: recipientAccountId,
        status: 'pending',
      },
    });

    revalidatePath('/access');
    revalidatePath('/access/member');
    return { success: true };
  } catch (error) {
    await logError('database', error, `cancelDirectInvitation:${recipientAccountId}`);
    return { success: false, error: 'Failed to cancel invitation.' };
  }
}

/**
 * Removes a member from a portfolio by looking up their portfolioMember row
 * and delegating to removeAssetGroupMember.
 */
export async function removePortfolioMember(
  portfolioId: string,
  memberAccountId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const member = await prisma.portfolioMember.findFirst({
      where: { portfolioId, accountId: memberAccountId },
      select: { id: true },
    });

    if (!member) return { success: false, error: 'Member not found in this portfolio.' };

    return await removeAssetGroupMember({ groupId: portfolioId, memberId: member.id });
  } catch (error) {
    await logError('database', error, `removePortfolioMember:${portfolioId}:${memberAccountId}`);
    return { success: false, error: 'Failed to remove member.' };
  }
}

/**
 * Cancels a pending portfolio-scoped access invitation.
 */
export async function cancelPortfolioInvitation(
  portfolioId: string,
  recipientAccountId: string,
): Promise<{ success: boolean; error?: string }> {
  const senderAccountId = await getActiveAccountId();
  if (!senderAccountId) return { success: false, error: 'Not authenticated.' };

  try {
    // Portfolio invitations store portfolioId in the data JSON field
    const pending = await prisma.request.findMany({
      where: {
        action: 'access_invitation',
        senderId: senderAccountId,
        recipientId: recipientAccountId,
        status: 'pending',
      },
      select: { id: true, data: true },
    });

    const ids = pending
      .filter((r) => (r.data as Record<string, unknown> | null)?.portfolioId === portfolioId)
      .map((r) => r.id);

    if (ids.length > 0) {
      await prisma.request.deleteMany({ where: { id: { in: ids } } });
    }

    revalidatePath('/access');
    revalidatePath(`/access/member?portfolio=${portfolioId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `cancelPortfolioInvitation:${portfolioId}:${recipientAccountId}`);
    return { success: false, error: 'Failed to cancel invitation.' };
  }
}
