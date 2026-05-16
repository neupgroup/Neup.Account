import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function EditApplicationPage({ params }: Props) {
  const { id } = await params;
  redirect(`/application/${id}`);
}
