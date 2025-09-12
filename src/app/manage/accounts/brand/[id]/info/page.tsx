

import { BrandProfileForm } from '@/app/manage/profile/brand-form';

export default function BrandInfoPage({ params }: { params: { id: string } }) {
  // eslint-disable-next-line react/no-children-prop
  return <BrandProfileForm accountId={params.id} children={undefined} />;
}
