
import { redirect } from 'next/navigation';

// This page just redirects to the view page by default.
export default function AppBasePage({ params }: { params: { slugid: string } }) {
  redirect(`/manage/root/app/${params.slugid}/view`);
}
