import { z } from "zod";
import { db } from '@/lib/firebase';
import { doc, getDoc } from "firebase/firestore";

export const loginFormSchema = z.object({
    neupId: z.string().min(1, "NeupID is required."),
    password: z.string().min(1, "Password is required."),
    geolocation: z.string().optional(),
});

export const registrationSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dob: z.date({ required_error: "Date of birth is required." }),
    nationality: z.string().min(1, "Nationality is required"),
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must agree to the terms and conditions on behalf of the dependent.",
    }),
    geolocation: z.string().optional(),
});

export const brandCreationSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    isLegalEntity: z.boolean().default(false),
    legalName: z.string().optional(),
    registrationId: z.string().optional(),
    hasHeadOffice: z.boolean().default(false),
    headOfficeLocation: z.string().optional(),
    servingAreas: z.string().optional(),
    neupId: z.string()
        .min(3, "NeupID must be at least 3 characters.")
        .regex(/^[a-z0-9-]+$/, "NeupID can only contain lowercase letters, numbers, and hyphens."),
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must accept the terms and conditions.",
    }),
}).superRefine((data, ctx) => {
    if (data.isLegalEntity && !data.legalName) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal name is required for legal entities.", path: ["legalName"] });
    }
    if (data.hasHeadOffice && !data.headOfficeLocation) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Head office location is required.", path: ["headOfficeLocation"] });
    }
});


export async function checkNeupIdAvailability(neupId: string): Promise<{ available: boolean }> {
    const lowerNeupId = neupId.toLowerCase();
    if (!lowerNeupId || lowerNeupId.length < 3) {
        return { available: false };
    }
    try {
        const neupidsRef = doc(db, 'neupid', lowerNeupId);
        const docSnap = await getDoc(neupidsRef);
        return { available: !docSnap.exists() };
    } catch (error) {
        console.error("Error checking NeupID availability:", error);
        // To be safe, report as unavailable on error
        return { available: false };
    }
}
