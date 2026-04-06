import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from "@/lib/user";
import { notFound } from "next/navigation";
import { getSocialLinks } from "@/services/manage/site/socials";
import { SocialLinksManager } from "./social-links-manager";

export default async function SocialSitesPage() {
    const canView = await checkPermissions(['root.site.social_accounts.read']);
    if (!canView) {
        notFound();
    }

    const initialLinks = await getSocialLinks();

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/site" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Social Sites</h1>
                <p className="text-muted-foreground">
                    Manage the company's social media links that appear on the site.
                </p>
            </div>
            <SocialLinksManager initialLinks={initialLinks} />
        </div>
    );
}
