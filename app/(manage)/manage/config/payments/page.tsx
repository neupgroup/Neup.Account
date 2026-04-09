import { notFound } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { checkPermissions } from '@/services/shared/user';
import { getPaymentSettings } from '@/services/manage/site/payments';
import { PaymentSettingsForm } from './payment-settings-form.client';

export default async function ConfigPaymentsPage() {
  const canView = await checkPermissions(['root.payment_config.view']);
  if (!canView) {
    notFound();
  }

  const initialSettings = await getPaymentSettings();

  return (
    <div className="grid gap-8">
      <BackButton href="/manage/config" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground">
          Define payment details used by the website checkout and billing flows.
        </p>
      </div>
      <PaymentSettingsForm initialSettings={initialSettings} />
    </div>
  );
}
