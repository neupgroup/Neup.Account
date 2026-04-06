
import { z } from "zod";

export const nameSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
});

export const displayNameSchema = z.object({
    displayName: z.string().min(3, "Display name must be at least 3 characters."),
});

export const demographicsSchema = z.object({
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dob: z.union([z.date(), z.string()]).refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
    }, { message: "Date of birth is required." }),
});

export const nationalitySchema = z.object({
    nationality: z.string().min(2, "Please select a country."),
});

export const contactSchema = z.object({
  phone: z.string().min(10, "A valid phone number is required."),
});

export const otpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits."),
});

export const neupidSchema = z.object({
  neupId: z.string().min(3, "NeupID must be at least 3 characters."),
});

export const passwordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters."),
});

export const termsSchema = z.object({
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must agree to the terms and conditions.",
    }),
});
