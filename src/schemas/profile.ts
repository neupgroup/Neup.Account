import { z } from "zod"

export const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  displayName: z.string().optional(),
  displayPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  gender: z.enum(["male", "female", "custom", "prefer_not_to_say"]),
  customGender: z.string().optional(),
  dob: z.date({ required_error: "A date of birth is required." }),
  primaryPhone: z.string().optional(),
  secondaryPhone: z.string().optional(),
  permanentLocation: z.string().optional(),
  currentLocation: z.string().optional(),
  newNeupIdRequest: z.string().optional(),
});

export const brandProfileFormSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  displayPhoto: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  isLegalEntity: z.boolean().default(false),
  legalName: z.string().optional(),
  registrationId: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  registeredOn: z.date().optional(),
}).superRefine((data, ctx) => {
  if (data.isLegalEntity) {
    if (!data.legalName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal name is required.", path: ["legalName"] });
    }
    if (!data.registrationId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration ID is required.", path: ["registrationId"] });
    }
     if (!data.countryOfOrigin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Country of origin is required.", path: ["countryOfOrigin"] });
    }
     if (!data.registeredOn) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration date is required.", path: ["registeredOn"] });
    }
  }
});
