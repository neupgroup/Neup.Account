'use server';

import { redirect } from 'next/navigation';
import { addAssetGroupMember, addAssetToGroup, assignAssetMemberRole, removeAssetFromGroup, bulkAssignAssetRoles } from '@/services/manage/access/assets';

/**
 * Function addMemberToAssetGroupFromForm.
 */
export async function addMemberToAssetGroupFromForm(groupId: string, formData: FormData) {
  await addAssetGroupMember({
    groupId,
    member: String(formData.get('member') || ''),
    isPermanent: formData.get('isPermanent') === 'on',
    validTill: String(formData.get('validTill') || ''),
    hasFullPermit: formData.get('hasFullPermit') === 'on',
  });

  redirect(`/access/portfolio/${groupId}`);
}


/**
 * Function addAssetToGroupFromForm.
 */
export async function addAssetToGroupFromForm(groupId: string, formData: FormData) {
  await addAssetToGroup({
    groupId,
    asset: String(formData.get('asset') || ''),
    type: String(formData.get('type') || ''),
    details: String(formData.get('details') || ''),
  });

  redirect(`/access/portfolio/${groupId}`);
}


/**
 * Function removeAssetFromGroupFromForm.
 *
 * Removes an asset from the portfolio and moves it back to the caller's
 * personal portfolio.
 */
export async function removeAssetFromGroupFromForm(groupId: string, formData: FormData) {
  await removeAssetFromGroup({
    groupId,
    portfolioAssetId: String(formData.get('portfolioAssetId') || ''),
  });

  redirect(`/access/portfolio/${groupId}`);
}


/**
 * Function assignRoleToAssetMemberFromForm.
 */
export async function assignRoleToAssetMemberFromForm(groupId: string, formData: FormData) {
  await assignAssetMemberRole({
    groupId,
    assetMember: String(formData.get('assetMember') || ''),
    asset: String(formData.get('asset') || ''),
    role: String(formData.get('role') || ''),
  });

  redirect(`/access/portfolio/${groupId}`);
}


/**
 * Function bulkAssignPermissionsFromForm.
 *
 * Handles the wizard form submission — assigns multiple roles to a member
 * across multiple assets.
 */
export async function bulkAssignPermissionsFromForm(groupId: string, formData: FormData) {
  const assetIdsRaw = String(formData.get('assetIds') || '');
  const roleIdsRaw = String(formData.get('roleIds') || '');

  await bulkAssignAssetRoles({
    groupId,
    memberId: String(formData.get('memberId') || ''),
    assetIds: assetIdsRaw.split(',').filter(Boolean),
    assetType: String(formData.get('assetType') || ''),
    roleIds: roleIdsRaw.split(',').filter(Boolean),
  });

  redirect(`/access/portfolio/${groupId}`);
}
