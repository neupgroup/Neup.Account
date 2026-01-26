
import { redirect } from 'next/navigation';

export default async function ManageBrandPage({ params }: { params: { id: string } }) {
    // Redirect to the info page by default
    redirect(`/manage/accounts/brand/${params.id}/info`);
}
