'use server';

import { redirect } from 'next/navigation';
import { deleteManagedApplication } from '@/services/manage/applications';

export async function deleteManagedApplicationFromDetailsPage(applicationId: string) {
  const result = await deleteManagedApplication(applicationId);
  if (result.success) {
    redirect('/data/applications');
  }
}
