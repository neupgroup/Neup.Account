
import { z } from "zod";

export const formSchema = z.object({
    // Step 1
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    // Step 2
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"], { required_error: "Please select a gender."}),
    customGender: z.string().optional(),
    dob: z.date({ required_error: "Date of birth is required." }),
    // Step 3
    nationality: z.string().min(1, "Nationality is required"),
    // Step 4
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
    // Step 5
    password: z.string().min(8, "Password must be at least 8 characters."),
    // Step 6
    agreement: z.boolean().refine((val) => val === true, {
        message: "You must accept the terms and conditions on behalf of the dependent.",
    }),
});
