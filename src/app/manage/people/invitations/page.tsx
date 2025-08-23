
"use client";

import { useState, useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getInvitations, acceptRequest, rejectRequest, type Invitation } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, X, Loader2, Users, Handshake } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';

function InvitationCard({ invitation, onAction }: { invitation: Invitation, onAction: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const getActionText = () => {
        if (invitation.action === 'family_invitation') {
            return `${invitation.senderName} has invited you to join their family.`;
        }
        if (invitation.action === 'access_invitation') {
            return `${invitation.senderName} wants to manage your account.`;
        }
        return 'You have a new request.';
    };

    const handleAccept = () => {
        startTransition(async () => {
            const result = await acceptRequest(invitation.requestId, invitation.notificationId);
            if (result.success) {
                toast({ title: 'Request accepted!', className: 'bg-accent text-accent-foreground' });
                onAction();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const handleReject = () => {
        startTransition(async () => {
            const result = await rejectRequest(invitation.requestId, invitation.notificationId);
            if (result.success) {
                toast({ title: 'Request rejected.' });
                onAction();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        });
    };

    const getIcon = () => {
        if (invitation.action === 'family_invitation') return <Users className="h-6 w-6 text-muted-foreground" />;
        if (invitation.action === 'access_invitation') return <Handshake className="h-6 w-6 text-muted-foreground" />;
        return <Users className="h-6 w-6 text-muted-foreground" />;
    }

    return (
        <Card>
            <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                    {getIcon()}
                    <div>
                        <p className="font-medium">{getActionText()}</p>
                        <p className="text-sm text-muted-foreground">@{invitation.senderNeupId}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isPending ? (
                        <Button variant="outline" size="icon" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-green-600 border-green-600 hover:bg-green-50" onClick={handleAccept}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleReject}>
                                <X className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function InvitationsPage() {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvitations = async () => {
        setLoading(true);
        const data = await getInvitations();
        setInvitations(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/people" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
                <p className="text-muted-foreground">
                    Accept or reject requests from other users.
                </p>
            </div>
            <div className="space-y-4">
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                ) : invitations.length > 0 ? (
                    invitations.map(inv => (
                        <InvitationCard key={inv.requestId} invitation={inv} onAction={fetchInvitations} />
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <h3 className="text-lg font-semibold">No pending invitations</h3>
                            <p>You're all caught up!</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
