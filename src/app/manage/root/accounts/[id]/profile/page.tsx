import { notFound } from 'next/navigation';
import { getUserDetails } from '@/actions/root/users';
import { ProfileForm } from './profile-form';
import { BackButton } from '@/components/ui/back-button';

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const userDetails = await getUserDetails(params.id);
  if (!userDetails) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <BackButton href={`/manage/root/accounts/${params.id}`} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Profile Information
        </h1>
        <p className="text-muted-foreground">
          View and edit profile details for @{userDetails.neupId}.
        </p>
      </div>
      <ProfileForm
        profile={userDetails.profile}
        accountId={userDetails.accountId}
      />
    </div>
  );
}
