'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/core/helpers/prisma';
import { getActiveAccountId, getPersonalAccountId } from '@/core/helpers/auth-actions';
import { checkPermissions } from '@/core/helpers/user';
import { logError } from '@/core/helpers/logger';
import {
  applicationAccessFields,
  type ApplicationAccessField,
  type ApplicationEndpointConfig,
  type ApplicationPolicyEntry,
  type ManagedApplication,
} from './application-types';

const createApplicationSchema = z.object({
  name: z.string().trim().min(1, 'Application name is required.').max(120, 'Application name is too long.'),
});

const saveSecretSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  secretKey: z.string().min(16, 'Secret key is required.'),
});

const saveAccessSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  access: z.array(z.enum(applicationAccessFields)).default([]),
});

const policyEntrySchema = z.object({
  name: z.string().trim().min(1, 'Policy name is required.').max(120, 'Policy name is too long.'),
  policy: z.string().trim().min(1, 'Policy content is required.'),
});

const savePoliciesSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  policies: z.array(policyEntrySchema).default([]),
});

const saveEndpointsSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  dataDeletionApi: z.string().trim().max(500).optional().or(z.literal('')),
  dataDeletionPage: z.string().trim().max(500).optional().or(z.literal('')),
  accountBlock: z.string().trim().max(4000).optional().or(z.literal('')),
  accountBlockApi: z.string().trim().max(500).optional().or(z.literal('')),
  logoutPage: z.string().trim().max(500).optional().or(z.literal('')),
  logoutApi: z.string().trim().max(500).optional().or(z.literal('')),
});

const updateApplicationStatusSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  status: z.enum(['development', 'active', 'rejected', 'blocked']),
});

const applicationAssetTypes = ['app', 'application'];
const viewRoleKeys = new Set(['application.view', 'app.view', 'application.edit', 'app.edit', 'application.manage', 'app.manage', 'manage', '*']);
const editRoleKeys = new Set(['application.edit', 'app.edit', 'application.manage', 'app.manage', 'manage', '*']);
const ownerRoleKeys = new Set(['application.owner', 'app.owner', 'owner', '*']);

/**
 * Function normalizeText.
 */
function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}


/**
 * Function normalizeAccess.
 */
function normalizeAccess(value: unknown): ApplicationAccessField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is ApplicationAccessField =>
    typeof entry === 'string' && (applicationAccessFields as readonly string[]).includes(entry)
  );
}


/**
 * Function normalizePolicies.
 */
function normalizePolicies(value: unknown): ApplicationPolicyEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const name = normalizeText(record.name);
      const policy = normalizeText(record.policy);

      if (!name || !policy) {
        return null;
      }

      return { name, policy };
    })
    .filter((entry): entry is ApplicationPolicyEntry => entry !== null);
}


/**
 * Function normalizeEndpoints.
 */
function normalizeEndpoints(value: unknown): ApplicationEndpointConfig {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    dataDeletionApi: normalizeText(record.dataDeletionApi),
    dataDeletionPage: normalizeText(record.dataDeletionPage),
    accountBlock: normalizeText(record.accountBlock),
    accountBlockApi: normalizeText(record.accountBlockApi),
    logoutPage: normalizeText(record.logoutPage),
    logoutApi: normalizeText(record.logoutApi),
  };
}


/**
 * Function resolveApplicationAccessForAccount.
 */
async function resolveApplicationAccessForAccount(accountId: string, appId: string): Promise<{ canView: boolean; canEdit: boolean }> {
  try {
    const [roleRows, memberRows] = await Promise.all([
      prisma.portfolioRole.findMany({
        where: {
          accountId,
          portfolio: {
            assets: {
              some: {
                assetId: appId,
                assetType: { in: applicationAssetTypes },
              },
            },
          },
        },
        select: {
          roleId: true,
        },
      }),
      prisma.portfolioMember.findMany({
        where: {
          accountId,
          portfolio: {
            assets: {
              some: {
                assetId: appId,
                assetType: { in: applicationAssetTypes },
              },
            },
          },
        },
        select: {
          details: true,
        },
      }),
    ]);

    if (roleRows.length === 0 && memberRows.length === 0) {
      return { canView: false, canEdit: false };
    }

    const hasFullAccess = memberRows.some((row) => {
      const details = (row.details ?? null) as Record<string, unknown> | null;
      if (!details || typeof details !== 'object') return false;
      const isPermanent = details.isPermanent === true;
      const removesOnRaw = details.removesOn;
      const removesOn = typeof removesOnRaw === 'string' || removesOnRaw instanceof Date
        ? new Date(removesOnRaw as string | Date)
        : null;
      const stillValid = isPermanent || (removesOn instanceof Date && !Number.isNaN(removesOn.getTime()) && removesOn > new Date());
      return stillValid && details.hasFullAccess === true;
    });

    if (hasFullAccess) {
      return { canView: true, canEdit: true };
    }

    const normalizedRoles = new Set(roleRows.map((row) => row.roleId.trim().toLowerCase()));
    const canEdit = Array.from(normalizedRoles).some((role) => editRoleKeys.has(role));
    const canView = canEdit || Array.from(normalizedRoles).some((role) => viewRoleKeys.has(role));

    return { canView, canEdit };
  } catch (error) {
    await logError('database', error, `resolveApplicationAccessForAccount:${accountId}:${appId}`);
    return { canView: false, canEdit: false };
  }
}


/**
 * Function getApplicationAuthorization.
 */
async function getApplicationAuthorization(accountId: string, appId: string): Promise<{ exists: boolean; canView: boolean; canEdit: boolean }> {
  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: { id: true, ownerAccountId: true },
  });

  if (!application) {
    return { exists: false, canView: false, canEdit: false };
  }

  if (application.ownerAccountId === accountId) {
    return { exists: true, canView: true, canEdit: true };
  }

  const access = await resolveApplicationAccessForAccount(accountId, appId);
  return { exists: true, canView: access.canView, canEdit: access.canEdit };
}


/**
 * Function isApplicationOwnerForAccount.
 */
async function isApplicationOwnerForAccount(accountId: string, appId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    select: { ownerAccountId: true },
  });

  if (!app) return false;
  if (app.ownerAccountId === accountId) return true;

  const ownerRoleRows = await prisma.portfolioRole.findMany({
    where: {
      accountId,
      portfolio: {
        assets: {
          some: {
            assetId: appId,
            assetType: { in: applicationAssetTypes },
          },
        },
      },
    },
    select: {
      roleId: true,
    },
  });

  return ownerRoleRows.some((row) => ownerRoleKeys.has(row.roleId.trim().toLowerCase()));
}


/**
 * Type ApplicationDetailsForViewer.
 */
export type ApplicationDetailsForViewer = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  developer?: string;
  configuredAccess: ApplicationAccessField[];
  accessedData: string[];
  hasUsedApp: boolean;
  policies: ApplicationPolicyEntry[];
  endpoints: ApplicationEndpointConfig;
  canDelete: boolean;
};


/**
 * Function getApplicationDetailsForViewer.
 */
export async function getApplicationDetailsForViewer(appId: string): Promise<ApplicationDetailsForViewer | null> {
  const activeAccountId = await getActiveAccountId();
  if (!activeAccountId) return null;

  const personalAccountId = await getPersonalAccountId();

  try {
    const authorization = await getApplicationAuthorization(activeAccountId, appId);
    if (!authorization.exists || !authorization.canView) return null;

    const [application, appSessions, canDelete] = await Promise.all([
      prisma.application.findUnique({
        where: { id: appId },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          developer: true,
          access: true,
          policies: true,
          endpoints: true,
        },
      }),
      personalAccountId
        ? prisma.portfolioRole.findMany({
            where: {
              accountId: personalAccountId,
              portfolio: {
                assets: {
                  some: {
                    assetId: appId,
                    assetType: { in: ['application', 'app'] },
                  },
                },
              },
            },
            select: { roleId: true },
          })
        : [],
      isApplicationOwnerForAccount(activeAccountId, appId),
    ]);

    if (!application) return null;

    const configuredAccess = normalizeAccess(application.access);
    const policies = normalizePolicies(application.policies);
    const endpoints = normalizeEndpoints(application.endpoints);

    const accessedData = Array.from(
      new Set(
        appSessions.map((row) => row.roleId)
      )
    );

    return {
      id: application.id,
      name: application.name,
      description: application.description || undefined,
      icon: application.icon || undefined,
      developer: application.developer || undefined,
      configuredAccess,
      accessedData,
      hasUsedApp: appSessions.length > 0,
      policies,
      endpoints,
      canDelete,
    };
  } catch (error) {
    await logError('database', error, `getApplicationDetailsForViewer:${appId}`);
    return null;
  }
}


/**
 * Function deleteManagedApplication.
 */
export async function deleteManagedApplication(appId: string): Promise<{ success: boolean; error?: string }> {
  const activeAccountId = await getActiveAccountId();
  if (!activeAccountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const canDelete = await isApplicationOwnerForAccount(activeAccountId, appId);
    if (!canDelete) {
      return { success: false, error: 'Only the application owner can delete this app.' };
    }

    await prisma.application.delete({
      where: { id: appId },
    });

    revalidatePath('/data/applications');
    return { success: true };
  } catch (error) {
    await logError('database', error, `deleteManagedApplication:${appId}`);
    return { success: false, error: 'Failed to delete application.' };
  }
}


/**
 * Function createManagedApplication.
 */
export async function createManagedApplication(input: { name: string }) {
  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid application name.' };
  }

  const canCreateApplication = await checkPermissions(['root.app.create']);
  if (!canCreateApplication) {
    return { success: false, error: 'Permission denied.' };
  }

  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const application = await prisma.$transaction(async (tx) => {
      const createdApp = await tx.application.create({
        data: {
          id: randomUUID(),
          name: parsed.data.name,
          ownerAccountId: accountId,
          status: 'development',
        },
        select: {
          id: true,
          name: true,
        },
      });

      let portfolio = await tx.portfolio.findFirst({
        where: {
          members: {
            some: {
              accountId,
            },
          },
        },
        select: { id: true },
      });

      if (!portfolio) {
        portfolio = await tx.portfolio.create({
          data: {
            name: 'My Portfolio',
            description: 'Default portfolio for your owned applications.',
          },
          select: { id: true },
        });
      }

      await tx.portfolioMember.upsert({
        where: {
          portfolioId_accountId: {
            portfolioId: portfolio.id,
            accountId,
          },
        },
        update: {
          details: {
            isPermanent: true,
            hasFullAccess: true,
          },
        },
        create: {
          portfolioId: portfolio.id,
          accountId,
          details: {
            isPermanent: true,
            hasFullAccess: true,
          },
        },
      });

      let appAsset = await tx.portfolioAsset.findFirst({
        where: {
          portfolioId: portfolio.id,
          assetId: createdApp.id,
          assetType: 'application',
        },
        select: { id: true },
      });

      if (!appAsset) {
        appAsset = await tx.portfolioAsset.create({
          data: {
            portfolioId: portfolio.id,
            assetId: createdApp.id,
            assetType: 'application',
            details: { primaryPortfolio: true },
          },
          select: { id: true },
        });
      }

      await tx.portfolioRole.upsert({
        where: {
          accountId_portfolioId_roleId: {
            accountId,
            portfolioId: portfolio.id,
            roleId: 'application.owner',
          },
        },
        create: {
          accountId,
          portfolioId: portfolio.id,
          roleId: 'application.owner',
          details: { assetId: createdApp.id },
        },
        update: {
          details: { assetId: createdApp.id },
        },
      });

      return { id: createdApp.id, groupId: portfolio.id };
    });

    revalidatePath('/data/applications');
    revalidatePath('/access');
    revalidatePath(`/access/${application.groupId}`);
    return { success: true, appId: application.id };
  } catch (error) {
    await logError('database', error, 'createManagedApplication');
    return { success: false, error: 'Failed to create application.' };
  }
}


/**
 * Function getManagedApplications.
 */
export async function getManagedApplications(): Promise<Array<{ id: string; name: string; slug?: string; icon?: string; developer?: string; createdAt: Date; hasSecretKey: boolean; status?: string }>> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return [];
  }

  try {
    const ownedApplications = await prisma.application.findMany({
      where: { ownerAccountId: accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        icon: true,
        developer: true,
        createdAt: true,
        appSecret: true,
        status: true,
      },
    });

    const ownedIds = new Set(ownedApplications.map((app) => app.id));

    const [roleRows, memberRows] = await Promise.all([
      prisma.portfolioRole.findMany({
        where: {
          accountId,
          portfolio: {
            assets: {
              some: {
                assetType: { in: applicationAssetTypes },
              },
            },
          },
        },
        select: {
          roleId: true,
          portfolio: {
            select: {
              assets: {
                where: { assetType: { in: applicationAssetTypes } },
                select: { assetId: true },
              },
            },
          },
        },
      }),
      prisma.portfolioMember.findMany({
        where: {
          accountId,
          portfolio: {
            assets: {
              some: {
                assetType: { in: applicationAssetTypes },
              },
            },
          },
        },
        select: {
          details: true,
          portfolio: {
            select: {
              assets: {
                where: { assetType: { in: applicationAssetTypes } },
                select: { assetId: true },
              },
            },
          },
        },
      }),
    ]);

    const permittedViewAppIds = new Set<string>();
    for (const row of roleRows) {
      const normalizedRole = row.roleId.trim().toLowerCase();
      if (viewRoleKeys.has(normalizedRole)) {
        row.portfolio.assets.forEach((asset) => permittedViewAppIds.add(asset.assetId));
      }
    }

    for (const row of memberRows) {
      const details = (row.details ?? null) as Record<string, unknown> | null;
      const hasFullAccess = Boolean(details && typeof details === 'object' && details.hasFullAccess === true);
      if (hasFullAccess) {
        row.portfolio.assets.forEach((asset) => permittedViewAppIds.add(asset.assetId));
      }
    }

    const permittedApplications = permittedViewAppIds.size
      ? await prisma.application.findMany({
          where: {
            id: { in: Array.from(permittedViewAppIds) },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            icon: true,
            developer: true,
            createdAt: true,
            appSecret: true,
            status: true,
          },
        })
      : [];

    const applications = [
      ...ownedApplications,
      ...permittedApplications.filter((app) => !ownedIds.has(app.id)),
    ];

    return applications.map((application) => ({
      id: application.id,
      name: application.name,
      icon: application.icon || undefined,
      developer: application.developer || undefined,
      createdAt: application.createdAt,
      hasSecretKey: Boolean(application.appSecret),
      status: application.status || undefined,
    }));
  } catch (error) {
    await logError('database', error, 'getManagedApplications');
    return [];
  }
}


/**
 * Function getManagedApplication.
 */
export async function getManagedApplication(appId: string): Promise<ManagedApplication | null> {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return null;
  }

  try {
    const authorization = await getApplicationAuthorization(accountId, appId);
    if (!authorization.exists || !authorization.canView) {
      return null;
    }

    const application = await prisma.application.findFirst({
      where: {
        id: appId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        appSecret: true,
        access: true,
        policies: true,
        endpoints: true,
      },
    });

    if (!application) {
      return null;
    }

    return {
      id: application.id,
      name: application.name,
      createdAt: application.createdAt,
      hasSecretKey: Boolean(application.appSecret),
      access: normalizeAccess(application.access),
      policies: normalizePolicies(application.policies),
      endpoints: normalizeEndpoints(application.endpoints),
    };
  } catch (error) {
    await logError('database', error, `getManagedApplication:${appId}`);
    return null;
  }
}


/**
 * Function saveApplicationSecret.
 */
export async function saveApplicationSecret(input: { appId: string; secretKey: string }) {
  const parsed = saveSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid secret key.' };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const authorization = await getApplicationAuthorization(accountId, parsed.data.appId);
    if (!authorization.exists) {
      return { success: false, error: 'Application not found.' };
    }
    if (!authorization.canEdit) {
      return { success: false, error: 'Permission denied.' };
    }

    const result = await prisma.application.updateMany({
      where: {
        id: parsed.data.appId,
      },
      data: {
        appSecret: parsed.data.secretKey,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Application not found.' };
    }

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${parsed.data.appId}`);

    return { success: true };
  } catch (error) {
    await logError('database', error, `saveApplicationSecret:${parsed.data.appId}`);
    return { success: false, error: 'Failed to save secret key.' };
  }
}


/**
 * Function saveApplicationAccess.
 */
export async function saveApplicationAccess(input: { appId: string; access: ApplicationAccessField[] }) {
  const parsed = saveAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid access list.' };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const authorization = await getApplicationAuthorization(accountId, parsed.data.appId);
    if (!authorization.exists) {
      return { success: false, error: 'Application not found.' };
    }
    if (!authorization.canEdit) {
      return { success: false, error: 'Permission denied.' };
    }

    const result = await prisma.application.updateMany({
      where: {
        id: parsed.data.appId,
      },
      data: {
        access: parsed.data.access,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Application not found.' };
    }

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${parsed.data.appId}`);

    return { success: true };
  } catch (error) {
    await logError('database', error, `saveApplicationAccess:${parsed.data.appId}`);
    return { success: false, error: 'Failed to save access list.' };
  }
}


/**
 * Function saveApplicationPolicies.
 */
export async function saveApplicationPolicies(input: { appId: string; policies: ApplicationPolicyEntry[] }) {
  const parsed = savePoliciesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid policies.' };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const authorization = await getApplicationAuthorization(accountId, parsed.data.appId);
    if (!authorization.exists) {
      return { success: false, error: 'Application not found.' };
    }
    if (!authorization.canEdit) {
      return { success: false, error: 'Permission denied.' };
    }

    const result = await prisma.application.updateMany({
      where: {
        id: parsed.data.appId,
      },
      data: {
        policies: parsed.data.policies,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Application not found.' };
    }

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${parsed.data.appId}`);

    return { success: true };
  } catch (error) {
    await logError('database', error, `saveApplicationPolicies:${parsed.data.appId}`);
    return { success: false, error: 'Failed to save policies.' };
  }
}


/**
 * Function saveApplicationEndpoints.
 */
export async function saveApplicationEndpoints(input: { appId: string } & ApplicationEndpointConfig) {
  const parsed = saveEndpointsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid endpoint information.' };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  try {
    const authorization = await getApplicationAuthorization(accountId, parsed.data.appId);
    if (!authorization.exists) {
      return { success: false, error: 'Application not found.' };
    }
    if (!authorization.canEdit) {
      return { success: false, error: 'Permission denied.' };
    }

    const result = await prisma.application.updateMany({
      where: {
        id: parsed.data.appId,
      },
      data: {
        endpoints: {
          dataDeletionApi: normalizeText(parsed.data.dataDeletionApi),
          dataDeletionPage: normalizeText(parsed.data.dataDeletionPage),
          accountBlock: normalizeText(parsed.data.accountBlock),
          accountBlockApi: normalizeText(parsed.data.accountBlockApi),
          logoutPage: normalizeText(parsed.data.logoutPage),
          logoutApi: normalizeText(parsed.data.logoutApi),
        },
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Application not found.' };
    }

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${parsed.data.appId}`);

    return { success: true };
  } catch (error) {
    await logError('database', error, `saveApplicationEndpoints:${parsed.data.appId}`);
    return { success: false, error: 'Failed to save endpoint information.' };
  }
}


/**
 * Function updateManagedApplicationStatus.
 */
export async function updateManagedApplicationStatus(input: { appId: string; status: 'development' | 'active' | 'rejected' | 'blocked' }) {
  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid application status.' };
  }

  const isRootAppManager = await checkPermissions(['root.app.view']);
  const isBrandManager = await checkPermissions(['linked_accounts.brand.manager']);
  if (!isRootAppManager && !isBrandManager) {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const result = await prisma.application.updateMany({
      where: {
        id: parsed.data.appId,
      },
      data: {
        status: parsed.data.status,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Application not found.' };
    }

    revalidatePath('/manage/applications');
    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${parsed.data.appId}`);

    return { success: true };
  } catch (error) {
    await logError('database', error, `updateManagedApplicationStatus:${parsed.data.appId}`);
    return { success: false, error: 'Failed to update application status.' };
  }
}
