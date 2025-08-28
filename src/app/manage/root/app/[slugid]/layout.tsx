
import { BackButton } from "@/components/ui/back-button";

export default function AppDetailsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slugid: string };
}) {

  return (
    <div className="grid gap-6">
       <BackButton href="/manage/root/app" />
        {children}
    </div>
  );
}
