import { z } from 'zod';

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const kycFormSchema = z.object({
    fullName: z.string().min(3, "Full name is required."),
    dob: z.string().min(1, "Date of birth is required."),
    nationality: z.string().min(2, "Nationality is required."),
    address: z.string().min(10, "A full address is required."),
    documentType: z.enum(['passport', 'license', 'national_id']),
    documentId: z.string().min(5, "A valid document ID is required."),
    documentPhoto: z.any()
        .refine(file => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
        .refine(file => ACCEPTED_IMAGE_TYPES.includes(file?.type), "Only .jpg, .jpeg, .png and .webp formats are supported."),
    selfiePhoto: z.any()
        .refine(value => value !== null, "Selfie is required."),
});

export type KycFormValues = z.infer<typeof kycFormSchema>;
