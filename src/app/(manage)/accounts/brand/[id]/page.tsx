
import { redirect } from 'next/navigation';

export default async function ManageBrandPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Redirect to the info page by default
    redirect(`/manage/accounts/brand/${id}/info`);
}
