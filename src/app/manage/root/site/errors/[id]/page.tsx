
import { notFound } from "next/navigation";
import { getErrorDetails, type SystemErrorDetails } from "@/actions/root/site";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const InfoItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="text-sm font-medium">{value || "N/A"}</div>
    </div>
);


export default async function ErrorDetailsPage({ params }: { params: { id: string } }) {
    const error = await getErrorDetails(params.id);

    if (!error) {
        notFound();
    }
    
    const typeVariantMap: { [key: string]: "default" | "destructive" | "secondary" } = {
        database: "destructive",
        auth: "destructive",
        ai: "secondary",
        validation: "secondary",
        unknown: "default",
    };

    return (
        <div className="grid gap-8">
            <BackButton href="/manage/root/site/errors" />
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Error Details
                </h1>
                <p className="text-muted-foreground font-mono text-sm">
                    ID: {error.id}
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Error Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <pre className="text-xs bg-muted/50 p-4 rounded-md whitespace-pre-wrap font-code break-all max-h-96 overflow-auto">
                                {error.fullError}
                            </pre>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle>Resolution Tracking</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="repro-steps">How to Reproduce</Label>
                                <Textarea id="repro-steps" placeholder="Describe the steps to reproduce this error..." defaultValue={error.reproSteps} />
                            </div>
                            <div>
                                <Label htmlFor="solution">How was it solved?</Label>
                                <Textarea id="solution" placeholder="Describe the solution or fix implemented..." defaultValue={error.solution} />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button>Save Details</Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="space-y-6 sticky top-24">
                    <Card>
                        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <InfoItem label="Type" value={<Badge variant={typeVariantMap[error.type] || "default"}>{error.type}</Badge>} />
                            <InfoItem label="Context" value={<span className="font-mono text-xs">{error.context}</span>} />
                            <InfoItem label="Timestamp" value={error.timestamp} />
                            <InfoItem label="User" value={error.user?.name || "System"} />
                            <InfoItem label="IP Address" value={error.ipAddress} />
                            <InfoItem label="Problem Level" value={
                                <Select defaultValue={error.problemLevel || "warm"}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Set level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hot">Hot (Critical)</SelectItem>
                                        <SelectItem value="warm">Warm (Standard)</SelectItem>
                                        <SelectItem value="cold">Cold (Low Priority)</SelectItem>
                                    </SelectContent>
                                </Select>
                            } />
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full">Mark as Solved</Button>
                        </CardFooter>
                    </Card>
                </div>

            </div>
        </div>
    );
}
