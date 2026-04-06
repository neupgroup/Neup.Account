import { z } from 'zod';

export const profileFormSchema = z.object({
    nameFirst: z.string().min(1, "First name is required"),
    nameMiddle: z.string().optional(),
    nameLast: z.string().min(1, "Last name is required"),
    nameDisplay: z.string().optional(),
    accountPhoto: z.string().url().optional().or(z.literal('')),
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"]),
    customGender: z.string().optional(),
    dateBirth: z.date().optional(),
    primaryPhone: z.string().optional(),
    secondaryPhone: z.string().optional(),
    permanentLocation: z.string().optional(),
    currentLocation: z.string().optional(),
    newNeupIdRequest: z.string().optional(),
});