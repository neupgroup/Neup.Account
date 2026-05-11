import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.BRIDGE_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get('x-bridge-secret') === secret;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Table =
  | 'authz_role_capability'
  | 'authz_account_access_grant'
  | 'authz_assets_access_grant';

type Operation =
  | 'insert'
  | 'updateOne'
  | 'update'
  | 'deleteOne'
  | 'delete'
  | 'deleteAll';

type WebhookBody = {
  table: Table;
  operation: Operation;
  data?: Record<string, unknown> | Record<string, unknown>[];
  id?: string | string[];
};

const VALID_TABLES: Table[] = [
  'authz_role_capability',
  'authz_account_access_grant',
  'authz_assets_access_grant',
];

const VALID_OPERATIONS: Operation[] = [
  'insert',
  'updateOne',
  'update',
  'deleteOne',
  'delete',
  'deleteAll',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ok(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

// ---------------------------------------------------------------------------
// Table handlers
// ---------------------------------------------------------------------------

async function handleRoleCapability(operation: Operation, body: WebhookBody): Promise<NextResponse> {
  switch (operation) {
    case 'insert': {
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      if (!d.roleId || !d.capabilityId) return err('Missing required fields: `roleId`, `capabilityId`.', 400);
      const record = await prisma.authzRoleCapability.create({
        data: {
          roleId: d.roleId as string,
          capabilityId: d.capabilityId as string,
          scope: (d.scope as string) ?? null,
          denormalizedCapability: d.denormalizedCapability ?? null,
          roleName: (d.roleName as string) ?? null,
        },
        select: { id: true },
      });
      return ok({ id: record.id }, 201);
    }

    case 'updateOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      await prisma.authzRoleCapability.update({
        where: { id: body.id },
        data: {
          ...(d.roleId !== undefined && { roleId: d.roleId as string }),
          ...(d.capabilityId !== undefined && { capabilityId: d.capabilityId as string }),
          ...(d.scope !== undefined && { scope: d.scope as string | null }),
          ...(d.denormalizedCapability !== undefined && { denormalizedCapability: d.denormalizedCapability }),
          ...(d.roleName !== undefined && { roleName: d.roleName as string | null }),
        },
      });
      return ok({ ok: true });
    }

    case 'update': {
      if (!Array.isArray(body.data)) return err('Missing required field: `data` (array).', 400);
      await Promise.all(
        body.data.map((item) => {
          const { id, ...rest } = item;
          if (!id) return Promise.resolve();
          return prisma.authzRoleCapability.update({ where: { id: id as string }, data: rest });
        })
      );
      return ok({ ok: true, count: body.data.length });
    }

    case 'deleteOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      await prisma.authzRoleCapability.delete({ where: { id: body.id } });
      return ok({ ok: true });
    }

    case 'delete': {
      if (!Array.isArray(body.id)) return err('Missing required field: `id` (array of strings).', 400);
      const result = await prisma.authzRoleCapability.deleteMany({ where: { id: { in: body.id as string[] } } });
      return ok({ ok: true, count: result.count });
    }

    case 'deleteAll': {
      const result = await prisma.authzRoleCapability.deleteMany();
      return ok({ ok: true, count: result.count });
    }
  }
}

async function handleAccountAccessGrant(operation: Operation, body: WebhookBody): Promise<NextResponse> {
  switch (operation) {
    case 'insert': {
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      if (!d.ownerAccountId || !d.targetAccountId || !d.roleId || !d.appId)
        return err('Missing required fields: `ownerAccountId`, `targetAccountId`, `roleId`, `appId`.', 400);
      const record = await prisma.authzAccountAccessGrant.create({
        data: {
          ownerAccountId: d.ownerAccountId as string,
          targetAccountId: d.targetAccountId as string,
          roleId: d.roleId as string,
          appId: d.appId as string,
          portfolioId: (d.portfolioId as string) ?? null,
        },
        select: { id: true },
      });
      return ok({ id: record.id }, 201);
    }

    case 'updateOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      await prisma.authzAccountAccessGrant.update({
        where: { id: body.id },
        data: {
          ...(d.roleId !== undefined && { roleId: d.roleId as string }),
          ...(d.portfolioId !== undefined && { portfolioId: d.portfolioId as string | null }),
        },
      });
      return ok({ ok: true });
    }

    case 'update': {
      if (!Array.isArray(body.data)) return err('Missing required field: `data` (array).', 400);
      await Promise.all(
        body.data.map((item) => {
          const { id, ...rest } = item;
          if (!id) return Promise.resolve();
          return prisma.authzAccountAccessGrant.update({ where: { id: id as string }, data: rest });
        })
      );
      return ok({ ok: true, count: body.data.length });
    }

    case 'deleteOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      await prisma.authzAccountAccessGrant.delete({ where: { id: body.id } });
      return ok({ ok: true });
    }

    case 'delete': {
      if (!Array.isArray(body.id)) return err('Missing required field: `id` (array of strings).', 400);
      const result = await prisma.authzAccountAccessGrant.deleteMany({ where: { id: { in: body.id as string[] } } });
      return ok({ ok: true, count: result.count });
    }

    case 'deleteAll': {
      const result = await prisma.authzAccountAccessGrant.deleteMany();
      return ok({ ok: true, count: result.count });
    }
  }
}

async function handleAssetsAccessGrant(operation: Operation, body: WebhookBody): Promise<NextResponse> {
  switch (operation) {
    case 'insert': {
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      if (!d.assetId || !d.accountId || !d.roleId || !d.appId)
        return err('Missing required fields: `assetId`, `accountId`, `roleId`, `appId`.', 400);
      const record = await prisma.authzAssetsAccessGrant.create({
        data: {
          asset_id: d.assetId as string,
          account_id: d.accountId as string,
          role_id: d.roleId as string,
          app_id: d.appId as string,
          portfolio_id: (d.portfolioId as string) ?? null,
          asset_type: (d.assetType as string) ?? null,
        },
        select: { id: true },
      });
      return ok({ id: record.id }, 201);
    }

    case 'updateOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      if (!body.data || Array.isArray(body.data)) return err('Missing required field: `data` (object).', 400);
      const d = body.data;
      await prisma.authzAssetsAccessGrant.update({
        where: { id: body.id },
        data: {
          ...(d.roleId !== undefined && { role_id: d.roleId as string }),
          ...(d.portfolioId !== undefined && { portfolio_id: d.portfolioId as string | null }),
          ...(d.assetType !== undefined && { asset_type: d.assetType as string | null }),
        },
      });
      return ok({ ok: true });
    }

    case 'update': {
      if (!Array.isArray(body.data)) return err('Missing required field: `data` (array).', 400);
      await Promise.all(
        body.data.map((item) => {
          const { id, roleId, portfolioId, assetType, ...rest } = item;
          if (!id) return Promise.resolve();
          return prisma.authzAssetsAccessGrant.update({
            where: { id: id as string },
            data: {
              ...(roleId !== undefined && { role_id: roleId as string }),
              ...(portfolioId !== undefined && { portfolio_id: portfolioId as string | null }),
              ...(assetType !== undefined && { asset_type: assetType as string | null }),
              ...rest,
            },
          });
        })
      );
      return ok({ ok: true, count: body.data.length });
    }

    case 'deleteOne': {
      if (typeof body.id !== 'string') return err('Missing required field: `id` (string).', 400);
      await prisma.authzAssetsAccessGrant.delete({ where: { id: body.id } });
      return ok({ ok: true });
    }

    case 'delete': {
      if (!Array.isArray(body.id)) return err('Missing required field: `id` (array of strings).', 400);
      const result = await prisma.authzAssetsAccessGrant.deleteMany({ where: { id: { in: body.id as string[] } } });
      return ok({ ok: true, count: result.count });
    }

    case 'deleteAll': {
      const result = await prisma.authzAssetsAccessGrant.deleteMany();
      return ok({ ok: true, count: result.count });
    }
  }
}

// ---------------------------------------------------------------------------
// POST /bridge/webhook.v1/authz/role
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  if (!verifySecret(request)) {
    return err('Missing or invalid x-bridge-secret header.', 401);
  }

  // 2. Parse body
  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return err('Request body must be valid JSON.', 400);
  }

  // 3. Validate table + operation
  if (!body.table || !VALID_TABLES.includes(body.table)) {
    return err(`Invalid or missing \`table\`. Must be one of: ${VALID_TABLES.join(', ')}.`, 400);
  }
  if (!body.operation || !VALID_OPERATIONS.includes(body.operation)) {
    return err(`Invalid or missing \`operation\`. Must be one of: ${VALID_OPERATIONS.join(', ')}.`, 400);
  }

  // 4. Dispatch
  try {
    switch (body.table) {
      case 'authz_role_capability':
        return await handleRoleCapability(body.operation, body);
      case 'authz_account_access_grant':
        return await handleAccountAccessGrant(body.operation, body);
      case 'authz_assets_access_grant':
        return await handleAssetsAccessGrant(body.operation, body);
    }
  } catch (error) {
    await logError('webhook', error, `authz/role:${body.table}:${body.operation}`);
    return err('Database or service error.', 500);
  }
}
