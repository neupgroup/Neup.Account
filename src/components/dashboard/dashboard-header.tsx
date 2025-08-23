
"use client";

import { useEffect, useState } from 'react';
import { type UserProfile } from '@/lib/user-actions';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';


function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

type HeaderData = {
    profile: UserProfile | null;
    neupId: string | null;
    totpEnabled: boolean;
    recoveryEmailSet: boolean;
};

export function DashboardHeader({ initialData }: { initialData: HeaderData | null }) {
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    useEffect(() => {
        if (initialData) {
            setLoading(false);
        }
    }, [initialData]);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            router.push(`/manage/search?q=${encodeURIComponent(searchTerm.trim())}`);
        }
    };
    
    if (loading || !initialData) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    const { profile, neupId } = initialData;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16 rounded-lg">
                    <AvatarImage src={profile?.displayPhoto} alt={profile?.displayName} data-ai-hint="person" />
                    <AvatarFallback className="rounded-lg text-xl">
                        {`${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}, {profile?.firstName || 'User'}!</h1>
                    <p className="text-muted-foreground font-mono">@{neupId}</p>
                </div>
            </div>

             <form onSubmit={handleSearch}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search settings, people, apps, invoices..." 
                        className="pl-10" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </form>
        </div>
    )
}
