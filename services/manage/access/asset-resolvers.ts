'use server';

import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

export type ResolvedAsset = {
  name: string;
  subtitle?: string;
};

// ── Per-type resolvers ────────────────────────────────────────────────────────

/**
 * Resolves an application asset by its application ID.
 * Returns the application name and status as subtitle.
 */
async function resolveApplicationAsset(assetId: string): Promise<ResolvedAsset | null> {
  try {
    const app = await prisma.application.findUnique({
      where: { id: assetId },
      select: { name: true, status: true },
    });
    if (!app) return null;
    return {
      name: app.name,
      subtitle: app.status ?? undefined,
    };
  } catch (error) {
    await logError('database', error, `resolveApplicationAsset:${assetId}`);
    return null;
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

const APPLICATION_TYPES = new Set(['application', 'app']);

/**
 * Resolves a human-readable name for any portfolio asset.
 * Falls back to the raw assetId if no resolver matches or the entity is not found.
 */
export async function resolveAssetName(
  assetId: string,
  assetType: string,
): Promise<ResolvedAsset> {
  const type = assetType.trim().toLowerCase();

  if (APPLICATION_TYPES.has(type)) {
    const result = await resolveApplicationAsset(assetId);
    if (result) return result;
  }

  // Fallback — unknown type or entity not found
  return { name: assetId, subtitle: assetType };
}

/**
 * Resolves names for a list of assets in parallel.
 * Returns a map keyed by portfolioAsset.id → ResolvedAsset.
 */
export async function resolveAssetNames(
  assets: Array<{ id: string; assetId: string; assetType: string }>,
): Promise<Record<string, ResolvedAsset>> {
  const entries = await Promise.all(
    assets.map(async (asset) => {
      const resolved = await resolveAssetName(asset.assetId, asset.assetType);
      return [asset.id, resolved] as const;
    }),
  );
  return Object.fromEntries(entries);
}
