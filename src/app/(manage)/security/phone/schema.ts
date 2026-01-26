
import { z } from "zod";

export const phoneFormSchema = z.object({
    phone: z.string().min(1, "Phone number cannot be empty."),
});
