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
