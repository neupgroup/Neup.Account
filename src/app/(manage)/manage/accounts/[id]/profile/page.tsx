
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ListItem } from '@/components/ui/list-item';
import { getUserDetails } from '@/actions/manage/users';
import { checkPermissions } from '@/lib/user';
import { BackButton } from '@/components/ui/back-button';
import { PrimaryHeader } from '@/components/ui/primary-header';
import { UserCircle, FileText, HeartHandshake, AtSign, Contact, ShieldCheck } from '@/components/icons';

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canView = await checkPermissions(['root.account.view_full']);
  if (!canView) {
    notFound();
  }

  const userDetails = await getUserDetails(id);
  if (!userDetails) {
    notFound();
  }

  const profileFeatures = [
    {
      icon: UserCircle,
      title: "Display Information",
      description: "Update the user's public display name and photo.",
      href: `/manage/accounts/${id}/profile/display`,
    },
    {
      icon: FileText,
      title: "Legal Name",
      description: "Manage the user's legal first, middle, and last name.",
      href: `/manage/accounts/${id}/profile/name`,
    },
    {
      icon: HeartHandshake,
      title: "Demographics",
      description: "Update the user's date of birth and gender.",
      href: `/manage/accounts/${id}/profile/demographics`,
    },
    {
      icon: AtSign,
      title: "NeupID",
      description: "Manage the user's unique NeupIDs.",
      href: `/manage/accounts/${id}/profile/neupid`,
    },
    {
      icon: Contact,
      title: "Contact Information",
      description: "Manage the user's phone numbers and addresses.",
      href: `/manage/accounts/${id}/profile/contact`,
    },
    {
      icon: ShieldCheck,
      title: "KYC & Verification",
      description: "Submit or review documents to verify identity.",
      href: `/manage/accounts/${id}/profile/documents`,
    },
  ];

  return (
    <div className="grid gap-8">
      <BackButton href={`/manage/accounts/${id}`} />
      <PrimaryHeader
        title="Profile Information"
        description={`Manage profile details for @${userDetails.neupId}.`}
      />
      <Card>
        <CardContent className="divide-y p-0">
          {profileFeatures.map((feature, index) => (
            <ListItem key={index} {...feature} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
