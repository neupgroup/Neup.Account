
import Link from "next/link";
import { getBrandAccounts } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Building, Plus, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getPersonalAccountId } from "@/lib/user-actions";

export default async function BrandAccountsPage() {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        // This page is only for personal accounts to manage brands.
        notFound();
    }
    const brandAccounts = await getBrandAccounts();

    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Manage Brand Accounts</h1>
                <p className="text-muted-foreground">
                    Select a brand to manage or create a new one.
                </p>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Your Brands</CardTitle>
                    <CardDescription>
                        A list of all brand accounts you manage.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {brandAccounts.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {brandAccounts.map(brand => (
                                <Card key={brand.id} className="flex flex-col">
                                    <CardHeader className="flex-row items-center gap-4">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={brand.logoUrl} alt={brand.name} data-ai-hint="logo" />
                                            <AvatarFallback>{brand.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-lg">{brand.name}</CardTitle>
                                            <CardDescription>{brand.plan} Plan</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow"></CardContent>
                                    <CardContent>
                                         <Button asChild className="w-full">
                                            <Link href={`/manage/accounts/brand/${brand.id}`}>Manage Brand <ArrowRight className="ml-2 h-4 w-4" /></Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 gap-4">
                            <Building className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="text-lg font-semibold">No Brand Accounts Found</h3>
                            <p className="text-sm text-muted-foreground">
                                You don't manage any brand accounts yet. Get started by creating one.
                            </p>
                        </div>
                    )}
                </CardContent>
                 <CardContent>
                    <div className="border-t pt-6">
                        <Button asChild>
                            <Link href="/manage/accounts/brand/create"><Plus className="mr-2 h-4 w-4" />Create New Brand</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
