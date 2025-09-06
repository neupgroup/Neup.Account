import { z } from "zod";

export const nameSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
});

export const demographicsSchema = z.object({
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dob: z.date({ required_error: "Date of birth is required." }),
    nationality: z.string().min(1, "Nationality is required"),
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
