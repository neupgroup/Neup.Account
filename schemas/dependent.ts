import { z } from "zod";

export const dependentFormSchema = z.object({
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
        message: "You must accept the terms and conditions on behalf of the dependent.",
    }),
});
