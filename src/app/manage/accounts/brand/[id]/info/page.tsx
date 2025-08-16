
import { BrandProfileForm } from '@/app/manage/profile/brand-form';

export default function BrandInfoPage({ params }: { params: { id: string } }) {
  return <BrandProfileForm accountId={params.id} />;
}
