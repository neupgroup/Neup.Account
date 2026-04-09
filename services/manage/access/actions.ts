'use server';

import { redirect } from 'next/navigation';
import { addAssetGroupMember, addAssetToGroup, assignAssetMemberRole } from '@/services/manage/access/assets';

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

  redirect(`/access/${groupId}`);
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

  redirect(`/access/${groupId}`);
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

  redirect(`/access/${groupId}`);
}
