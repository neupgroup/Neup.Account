import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { checkPermissions } from '@/core/helpers/user';
import { getSocialLinks } from '@/services/manage/site/socials';
import { SocialLinksManager } from '../../site/socials/social-links-manager';

export default async function ConfigSocialsPage() {
  const canView = await checkPermissions(['root.payment_config.view']);
  if (!canView) {
    notFound();
  }

  const initialLinks = await getSocialLinks();

  return (
    <div className="grid gap-8">
      <BackButton href="/manage/config" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Footer Social Accounts</h1>
        <p className="text-muted-foreground">
          Add and manage social media links shown in the website footer.
        </p>
      </div>
      <SocialLinksManager initialLinks={initialLinks} />
    </div>
  );
}
