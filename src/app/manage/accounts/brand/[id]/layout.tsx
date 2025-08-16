
import { notFound } from 'next/navigation';
import { getUserProfile } from '@/lib/user-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BrandNav } from './brand-nav';
import { BackButton } from '@/components/ui/back-button';

export default async function BrandManagementLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const brandProfile = await getUserProfile(params.id);

  if (!brandProfile) {
    notFound();
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-8 items-start">
      <div className="flex flex-col gap-4 sticky top-24">
        <BackButton href="/manage/accounts/brand" />
         <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
                <AvatarImage src={brandProfile.displayPhoto} alt={brandProfile.displayName} data-ai-hint="logo" />
                <AvatarFallback>{brandProfile.displayName?.charAt(0) ?? 'B'}</AvatarFallback>
            </Avatar>
            <div>
                <h2 className="text-xl font-bold tracking-tight">{brandProfile.displayName}</h2>
                <p className="text-sm text-muted-foreground">Brand Management</p>
            </div>
        </div>
        <BrandNav brandId={params.id} />
      </div>
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
