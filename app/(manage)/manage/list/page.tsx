import { redirect } from 'next/navigation';

// /manage/list has moved to /manage/accounts
export default function ListRedirect({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string }>;
}) {
    const params = new URLSearchParams();
    // searchParams is a Promise in Next.js 15 — redirect synchronously with no params
    // The client will land on /manage/accounts and can re-apply filters from there
    redirect('/manage/accounts');
}
