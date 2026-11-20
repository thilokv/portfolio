import { z } from "zod";

/** Password policy: 10+ chars with letters and digits. Messages are i18n keys. */
export const passwordSchema = z
  .string()
  .min(10, "validation.passwordMin")
  .max(128, "validation.tooLong")
  .regex(/[A-Za-z]/, "validation.passwordLetters")
  .regex(/[0-9]/, "validation.passwordDigits");

export const loginSchema = z.object({
  email: z.email("validation.email").max(254),
  password: z.string().min(1, "validation.required").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.email("validation.email").max(254) });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "validation.passwordMismatch" });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.required"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "validation.passwordMismatch" });
