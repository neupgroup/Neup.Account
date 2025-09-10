
'use server';

import { getActiveAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';

// Make sure to set this in your environment variables
const UPLOAD_URL = process.env.NEXT_PUBLIC_UPLOAD_URL || 'https://neupgroup.com/usercontent/bridge/api/upload.php';

export async function uploadFile(
  file: File,
  platform: string,
  contentId: string,
  name?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', platform);
    formData.append('userid', accountId);
    formData.append('contentid', contentId);
    if (name) {
      formData.append('name', name);
    }

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        await logError('unknown', `Upload API failed with status ${response.status}: ${errorText}`, 'file-upload');
        return { success: false, error: `Upload failed: ${response.statusText}` };
    }

    const result = await response.json();

    if (result.success) {
      // Construct the full URL
      const fullUrl = `https://neupgroup.com${result.url}`;
      return { success: true, url: fullUrl };
    } else {
      await logError('unknown', `Upload API returned an error: ${result.message}`, 'file-upload');
      return { success: false, error: result.message || "An unknown error occurred during upload." };
    }

  } catch (error: any) {
    await logError('unknown', error, 'uploadFile-action');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
