import { BackButton } from "@/components/ui/back-button";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slugid: string }>;
}) {
  const { slugid } = await params;

  return (
    <div className="grid gap-6">
       <BackButton href="/manage/app" />
        {children}
    </div>
  );
}