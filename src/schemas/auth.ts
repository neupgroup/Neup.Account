import { z } from "zod";
import { db } from '@/lib/firebase';
import { doc, getDoc } from "firebase/firestore";

export const loginFormSchema = z.object({
    neupId: z.string().min(1, "NeupID is required."),
    password: z.string().min(1, "Password is required."),
    geolocation: z.string().optional(),
});

export const registrationSchema = z.object({
    nameFirst: z.string().min(1, "First name is required"),
    nameMiddle: z.string().optional(),
    nameLast: z.string().min(1, "Last name is required"),
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dateBirth: z.date({ required_error: "Date of birth is required." }),
    nationality: z.string().min(1, "Nationality is required"),
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must agree to the terms and conditions on behalf of the dependent.",
    }),
    geolocation: z.string().optional(),
});

export const brandCreationSchema = z.object({
    nameBrand: z.string().min(1, "Brand name is required"),
    isLegalEntity: z.boolean().default(false),
    nameLegal: z.string().optional(),
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
    if (data.isLegalEntity && !data.nameLegal) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal name is required for legal entities.", path: ["nameLegal"] });
    }
    if (data.hasHeadOffice && !data.headOfficeLocation) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Head office location is required.", path: ["headOfficeLocation"] });
    }
});

export const brandProfileFormSchema = z.object({
  nameDisplay: z.string().min(1, "Display name is required"),
  accountPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  isLegalEntity: z.boolean().default(false),
  nameLegal: z.string().optional(),
  registrationId: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  dateEstablished: z.date().optional(),
}).superRefine((data, ctx) => {
  if (data.isLegalEntity) {
    if (!data.nameLegal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal name is required.", path: ["nameLegal"] });
    }
    if (!data.registrationId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration ID is required.", path: ["registrationId"] });
    }
     if (!data.countryOfOrigin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country of origin is required.", path: ["countryOfOrigin"] });
    }
     if (!data.dateEstablished) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Establishment date is required.", path: ["dateEstablished"] });
    }
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
