import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button";
import { checkPermissions } from '@/core/helpers/user';
import { notFound } from "next/navigation";

export default async function PoliciesPage() {
    const canView = await checkPermissions(['data.agreed_terms.view']);
    if (!canView) {
        notFound();
    }
    
    return (
        <div className="grid gap-8">
            <BackButton href="/manage/data" />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Policies & Agreements</h1>
                <p className="text-muted-foreground">
                    Review our terms, policies, and legal agreements.
                </p>
            </div>
            <div className="space-y-2">
                 <h2 className="text-xl font-semibold tracking-tight">Policies</h2>
                <p className="text-muted-foreground text-sm">
                    Find important legal and service-level documents below.
                </p>
                <Card>
                    <CardContent className="p-4">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>Terms of Service</AccordionTrigger>
                                <AccordionContent className="prose prose-invert max-w-none text-muted-foreground">
                                    <p>
                                        Welcome to NeupID. These terms and conditions outline the rules and regulations for the use of
                                        NeupID's Website, located at neupid.app. By accessing this website we assume you accept
                                        these terms and conditions. Do not continue to use NeupID if you do not agree to take all of the
                                        terms and conditions stated on this page.
                                    </p>
                                    <p>
                                        The following terminology applies to these Terms and Conditions, Privacy Statement and Disclaimer
                                        Notice and all Agreements: "Client", "You" and "Your" refers to you, the person log on this
                                        website and compliant to the Company’s terms and conditions. "The Company", "Ourselves", "We",
                                        "Our" and "Us", refers to our Company. "Party", "Parties", or "Us", refers to both the Client
                                        and ourselves.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger>Privacy Policy</AccordionTrigger>
                                <AccordionContent className="prose prose-invert max-w-none text-muted-foreground">
                                    <p>
                                        At NeupID, accessible from neupid.app, one of our main priorities is the privacy of our
                                        visitors. This Privacy Policy document contains types of information that is collected and
                                        recorded by NeupID and how we use it.
                                    </p>
                                    <p>
                                        If you have additional questions or require more information about our Privacy Policy, do not
                                        hesitate to contact us. This Privacy Policy applies only to our online activities and is valid for
                                        visitors to our website with regards to the information that they shared and/or collect in
                                        NeupID.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3">
                                <AccordionTrigger>Acceptable Use Policy</AccordionTrigger>
                                <AccordionContent className="prose prose-invert max-w-none text-muted-foreground">
                                    <p>
                                        This policy outlines acceptable use of the NeupID platform. Prohibited activities include, but
                                        are not limited to: attempting to gain unauthorized access to the system, uploading malicious
                                        software, engaging in any activity that is illegal or fraudulent, and infringing on the
                                        intellectual property rights of others. Violation of this policy may result in suspension or
                                        termination of your account.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-4">
                                <AccordionTrigger>Service Level Agreement (SLA)</AccordionTrigger>
                                <AccordionContent className="prose prose-invert max-w-none text-muted-foreground">
                                    <p>
                                        NeupID commits to a 99.9% uptime for all core services. Scheduled maintenance will be
                                        announced at least 48 hours in advance. In the event of an unplanned outage, our team will work
                                        to restore service as quickly as possible. Support requests will receive an initial response
                                        within 4 business hours.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
