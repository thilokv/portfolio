import { z } from "zod";
import { AVAILABILITY_STATUSES, STAFF_ROLES } from "../constants";
import { dateReq, opt, phoneOpt, req, uuid } from "./common";

export const staffSchema = z.object({
  id: z.string().optional(),
  fullName: req(120),
  email: z.email("validation.email").max(254),
  phone: phoneOpt,
  designation: opt(120),
  qualifications: opt(300),
  registrationNumber: opt(60),
  roles: z.array(z.enum(STAFF_ROLES)).min(1, "validation.selectOne"),
});
export type StaffInput = z.infer<typeof staffSchema>;

export const availabilitySchema = z.object({ staffId: uuid, date: dateReq, status: z.enum(AVAILABILITY_STATUSES), note: opt(300) });
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const serviceUpdateSchema = z.object({
  id: uuid,
  name: req(120),
  nameTe: opt(120),
  description: opt(1000),
  defaultDurationMinutes: z.string().refine((v) => /^\d+$/.test(v) && +v >= 5 && +v <= 480, "validation.number"),
  isActive: z.boolean(),
});
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
