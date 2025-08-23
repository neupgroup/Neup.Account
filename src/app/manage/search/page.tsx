
import { Suspense } from 'react';
import { searchAll } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/ui/back-button';
import { Skeleton } from '@/components/ui/skeleton';

async function SearchResults({ query }: { query: string }) {
    const results = await searchAll(query);

    const iconMap = {
        user: UserCircle,
        permission: ShieldCheck,
    };

    return (
        <div className="grid gap-6">
            <div>
                 <h1 className="text-3xl font-bold tracking-tight">Search Results</h1>
                 <p className="text-muted-foreground">
                    Found {results.length} results for <span className="font-semibold text-foreground">&quot;{query}&quot;</span>
                </p>
            </div>
           
            {results.length > 0 ? (
                <div className="space-y-4">
                    {results.map((item) => {
                        const Icon = iconMap[item.type] || UserCircle;
                        return (
                            <Card key={item.id}>
                                <CardContent className="p-4">
                                     <Link href={item.url} className="flex items-center gap-4 group">
                                        <Icon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                                        <div className="flex-grow">
                                            <p className="font-semibold group-hover:underline">{item.title}</p>
                                            <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                                        </div>
                                        <Badge variant="outline">{item.type}</Badge>
                                    </Link>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <p>No results found for your query.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function SearchSkeleton() {
    return (
        <div className="grid gap-6">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-6 w-1/3 mt-2" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
}


export default function SearchPage({ searchParams }: { searchParams?: { q?: string } }) {
    const query = searchParams?.q || '';

    return (
        <div className="grid gap-6">
            <BackButton href="/manage/home" />
            <Suspense fallback={<SearchSkeleton />}>
                <SearchResults query={query} />
            </Suspense>
        </div>
    );
}
