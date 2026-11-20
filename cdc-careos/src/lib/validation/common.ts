import { z } from "zod";

export const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{9}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const req = (max = 200) => z.string().trim().min(1, "validation.required").max(max, "validation.tooLong");
export const opt = (max = 5000) => z.string().trim().max(max, "validation.tooLong");
export const phoneReq = z.string().trim().regex(PHONE_RE, "validation.phone");
export const phoneOpt = z
  .string()
  .trim()
  .refine((v) => v === "" || PHONE_RE.test(v), "validation.phone");
export const emailOpt = z
  .string()
  .trim()
  .max(254, "validation.tooLong")
  .refine((v) => v === "" || z.email().safeParse(v).success, "validation.email");

export const isValidDate = (v: string) => DATE_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
export const dateReq = z.string().refine(isValidDate, "validation.date");
export const dateOpt = z.string().refine((v) => v === "" || isValidDate(v), "validation.date");
export const uuid = z.uuid("validation.invalid");
export const uuidOpt = z.string().refine((v) => v === "" || z.uuid().safeParse(v).success, "validation.invalid");
/** Integer as string (HTML inputs) — "" allowed. */
export const intStrOpt = (min = 0, max = 10000) =>
  z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), "validation.number");
