'use server';

import { updateManagedApplicationStatus } from '@/services/manage/applications';

const statusOptions = ['development', 'active', 'rejected', 'blocked'] as const;
type AppStatus = (typeof statusOptions)[number];

export async function updateManagedApplicationStatusFromForm(formData: FormData) {
  const appId = String(formData.get('appId') || '');
  const status = String(formData.get('status') || '') as AppStatus;

  if (!statusOptions.includes(status)) {
    return;
  }

  await updateManagedApplicationStatus({ appId, status });
}
