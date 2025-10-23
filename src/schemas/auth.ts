import { z } from 'zod';

export const registrationSchema = z.object({
    neupId: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
    // Add other required fields
});

export const loginFormSchema = z.object({
    neupId: z.string().min(1, "NeupID is required"),
    password: z.string().min(1, "Password is required"),
    geolocation: z.string().optional(),
});

export const brandCreationSchema = z.object({
    nameBrand: z.string().min(1, "Brand name is required"),
    isLegalEntity: z.boolean(),
    nameLegal: z.string().optional(),
    registrationId: z.string().optional(),
    hasHeadOffice: z.boolean(),
    headOfficeLocation: z.string().optional(),
    servingAreas: z.string().optional(),
    neupId: z.string().min(3, "NeupID must be at least 3 characters"),
    agreement: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

export const brandProfileFormSchema = z.object({
    nameDisplay: z.string().min(1, "Display name is required"),
    accountPhoto: z.string().url().optional().or(z.literal('')),
    isLegalEntity: z.boolean(),
    nameLegal: z.string().optional(),
    registrationId: z.string().optional(),
    countryOfOrigin: z.string().optional(),
    dateEstablished: z.date().optional(),
});