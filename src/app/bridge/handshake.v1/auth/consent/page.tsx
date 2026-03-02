import React from 'react';
import prisma from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getActiveSession } from '@/lib/auth-actions';
import { redirect } from 'next/navigation';
import { ExternalLink, Globe, ShieldCheck, UserCircle, Check } from '@/components/icons';
import Image from 'next/image';
import { getUserProfile } from '@/lib/user';

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    const appId = params.appId as string;
    const authHandler = params.auth_handler as string;

    if (!appId || !authHandler) {
        redirect('/auth/start?error=invalid_request');
    }

    const session = await getActiveSession();
    if (!session) {
        // This should not happen if the flow is correct, but just in case
        const searchParamsObj = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                searchParamsObj.set(key, Array.isArray(value) ? value[0] : value);
            }
        });
        const backTo = `/bridge/handshake.v1/auth/signin?${searchParamsObj.toString()}`;
        redirect(`/auth/start?redirects=${encodeURIComponent(backTo)}`);
    }

    const [application, profile] = await Promise.all([
        prisma.application.findUnique({
            where: { id: appId }
        }),
        getUserProfile(session.accountId)
    ]);

    if (!application) {
        redirect('/auth/start?error=invalid_app');
    }

    const searchParamsObj = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            searchParamsObj.set(key, Array.isArray(value) ? value[0] : value);
        }
    });
    searchParamsObj.set('consent', 'true');
    const continueUrl = `/bridge/handshake.v1/auth/signin?${searchParamsObj.toString()}`;

    const displayName = profile?.displayName || profile?.nameDisplay || profile?.nameFirst || 'User';

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border shadow-lg overflow-hidden">
                <div className="h-1 bg-primary" />
                <CardHeader className="text-center pt-8">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/10">
                        {application.icon ? (
                            <div className="relative h-full w-full">
                                <Image 
                                    src={application.icon} 
                                    alt={application.name} 
                                    fill 
                                    className="object-contain rounded-xl"
                                />
                            </div>
                        ) : (
                            <Globe className="h-10 w-10 text-primary" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Sign in with NeupID</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Continue to <span className="font-semibold text-foreground">{application.name}</span>
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6 px-8">
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">This application will receive access to:</p>
                        <div className="space-y-2">
                            <div className="flex items-start gap-3 text-sm">
                                <div className="mt-0.5 rounded-full bg-green-500/10 p-0.5">
                                    <Check className="h-3 w-3 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-medium">Public Profile</p>
                                    <p className="text-xs text-muted-foreground">Your name, display name, and profile photo.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <div className="mt-0.5 rounded-full bg-green-500/10 p-0.5">
                                    <Check className="h-3 w-3 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-medium">Account Identifiers</p>
                                    <p className="text-xs text-muted-foreground">Your unique NeupID and internal account ID.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {application.description && (
                        <div className="rounded-xl border bg-muted/30 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">About the app</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{application.description}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                            {application.website && (
                                <div className="flex items-center gap-2">
                                    <Globe className="h-3.5 w-3.5" />
                                    <a href={application.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
                                        {new URL(application.website).hostname} <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                                <span>Verified Developer</span>
                            </div>
                        </div>
                        {application.party === 'first' && (
                            <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                Official App
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 p-8 bg-muted/20 border-t">
                    <Button asChild className="w-full h-12 text-base font-semibold shadow-sm">
                        <Link href={continueUrl}>
                            Continue as {displayName}
                        </Link>
                    </Button>
                    <div className="flex w-full items-center justify-between px-1">
                        <Button variant="link" asChild className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                            <Link href="/">
                                Cancel
                            </Link>
                        </Button>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <UserCircle className="h-3 w-3" />
                            <span>{session.accountId.substring(0, 8)}...</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
