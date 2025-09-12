
import { z } from 'zod';

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

// This schema is now used on the client-side to validate the form before uploading
// The server action will receive URLs instead of File objects.
export const kycFormSchema = z.object({
    fullName: z.string().min(3, "Full name is required.").optional(),
    dob: z.string().min(1, "Date of birth is required.").optional(),
    nationality: z.string().min(2, "Nationality is required.").optional(),
    address: z.string().min(10, "A full address is required.").optional(),
    documentType: z.enum(['passport', 'license', 'national_id']),
    documentId: z.string().min(5, "A valid document ID is required."),
    documentPhoto: z.any()
        .refine((file) => file, "Document photo is required.")
        .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
        .refine(
          (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
          "Only .jpg, .jpeg, .png, .webp, and .pdf formats are supported."
        ),
    selfiePhoto: z.any()
        .refine((file) => file, "Selfie photo is required.")
        .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
        .refine(
          (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
          "Only .jpg, .jpeg, .png, and .webp formats are supported."
        ),
});

export type KycFormValues = z.infer<typeof kycFormSchema>;
