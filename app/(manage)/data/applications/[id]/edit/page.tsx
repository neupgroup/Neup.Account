import { redirect } from 'next/navigation';

type EditApplicationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditApplicationPage({ params }: EditApplicationPageProps) {
  const { id } = await params;
  redirect(`/data/applications/${id}`);
}
