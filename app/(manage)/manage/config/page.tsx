import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CreditCard, Globe, ArrowRight, AppWindow } from '@/components/icons';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackButton } from '@/components/ui/back-button';
import { checkPermissions } from '@/core/helpers/user';
import { PrimaryHeader } from '@/components/ui/primary-header';

const configItems = [
  {
    href: '/manage/config/socials',
    title: 'Social Accounts',
    description: 'Define social links shown in the website footer.',
    icon: Globe,
  },
  {
    href: '/manage/config/payments',
    title: 'Payment Settings',
    description: 'Define payment details used across the website.',
    icon: CreditCard,
  },
  {
    href: '/manage/config/app',
    title: 'App Settings',
    description: 'Update the site logo used across the application.',
    icon: AppWindow,
  },
];

export default async function ManageConfigPage() {
  const canView = await checkPermissions(['root.payment_config.view']);
  if (!canView) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <BackButton href="/manage" />

      <PrimaryHeader
        title="Configurations"
        description="Set website payment settings, footer social media accounts, and app branding."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {configItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/40">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
