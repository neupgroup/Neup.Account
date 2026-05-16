'use server';

import { redirect } from 'next/navigation';
import { addAssetGroupMember, addAssetToGroup, assignAssetMemberRole, removeAssetFromGroup, removeAssetGroupMember, bulkAssignAssetRoles, updatePortfolioMemberFlags } from '@/services/manage/access/assets';

/**
 * Function addMemberToAssetGroupFromForm.
 *
 * Sends a portfolio membership invitation. Invited members always start with
 * isPermanent: false and hasFullAccess: false — those flags can only be
 * updated later by a permanent full-access member.
 */
export async function addMemberToAssetGroupFromForm(groupId: string, formData: FormData) {
  await addAssetGroupMember({
    groupId,
    member: String(formData.get('member') || ''),
  });

  redirect(`/access/member?portfolio=${groupId}`);
}


/**
 * Function removeMemberFromAssetGroupFromForm.
 */
export async function removeMemberFromAssetGroupFromForm(groupId: string, formData: FormData) {
  await removeAssetGroupMember({
    groupId,
    memberId: String(formData.get('memberId') || ''),
  });

  redirect(`/access/member?portfolio=${groupId}`);
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

  redirect(`/access/asset?portfolio=${groupId}`);
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

  redirect(`/access/asset?portfolio=${groupId}`);
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

  redirect(`/access/assign?portfolio=${groupId}`);
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

  redirect(`/access/assign?portfolio=${groupId}`);
}


/**
 * Function updatePortfolioMemberFlagsFromForm.
 *
 * Updates isPermanent and hasFullAccess on a confirmed portfolio member.
 * Only callable by a permanent full-access member.
 */
export async function updatePortfolioMemberFlagsFromForm(
  groupId: string,
  memberAccountId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  return updatePortfolioMemberFlags({
    groupId,
    memberId: String(formData.get('memberId') || ''),
    isPermanent: formData.get('isPermanent') === 'on',
    hasFullAccess: formData.get('hasFullAccess') === 'on',
  });
}
