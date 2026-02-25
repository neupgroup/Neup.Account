
'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { checkAppIdExists } from '@/actions/root/permission/index';
import { checkPermissions } from '@/lib/user';

const singlePermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    permissions: z.string()
        .min(1, { message: "Access permissions string cannot be empty." })
        .refine(value => {
            const permissions = value.split(',').map(s => s.trim()).filter(Boolean);
            return permissions.length > 0 && permissions.every(p => /^[a-z_.]+\.[a-z_.]+$/.test(p));
        }, { message: "All permissions must be in 'domain.action' format." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

export type BulkAddResult = {
    name: string;
    status: 'success' | 'error';
    message: string;
};

export async function bulkAddPermissions(
    appId: string, 
    intendedFor: 'individual' | 'brand' | 'dependent' | 'branch' | 'root',
    permissionsJson: string
): Promise<BulkAddResult[]> {
    const canBulkImport = await checkPermissions(['root.permission.bulk_import']);
    if (!canBulkImport) {
        return [{ name: "System", status: 'error', message: "Permission denied." }];
    }

    const results: BulkAddResult[] = [];

    // 1. Validate App ID
    const appExists = await checkAppIdExists(appId);
    if (!appExists.exists) {
        return [{ name: "System", status: 'error', message: `App Slug '${appId}' does not exist.` }];
    }

    // 2. Validate JSON structure
    let parsedPermissions;
    try {
        const jsonData = JSON.parse(permissionsJson);
        const validation = z.array(singlePermissionSchema).safeParse(jsonData);
        if (!validation.success) {
            return [{
                name: "JSON Validation",
                status: 'error',
                message: `Invalid JSON structure: ${validation.error.flatten().formErrors.join(', ')}`
            }];
        }
        parsedPermissions = validation.data;
    } catch (e) {
        return [{ name: "JSON Parsing", status: 'error', message: "Invalid JSON format." }];
    }

    // 3. Process each permission
    for (const perm of parsedPermissions) {
        try {
            const existing = await prisma.permission.findUnique({
                where: { name: perm.name }
            });
            if (existing) {
                results.push({ name: perm.name, status: 'error', message: 'This permission set name already exists.' });
                continue;
            }

            const accessArray = perm.permissions.split(',').map(s => s.trim()).filter(Boolean);

            await prisma.permission.create({
                data: {
                    name: perm.name,
                    appId: appId,
                    access: accessArray,
                    description: perm.description,
                    intendedFor: intendedFor,
                }
            });
            results.push({ name: perm.name, status: 'success', message: 'Successfully added.' });
        } catch (error) {
            await logError('database', error, `bulkAddPermissions for item: ${perm.name}`);
            results.push({ name: perm.name, status: 'error', message: 'An unexpected error occurred during import.' });
        }
    }

    revalidatePath('/manage/root/permission');
    return results;
}
