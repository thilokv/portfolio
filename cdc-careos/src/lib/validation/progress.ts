import { z } from "zod";
import { ASSISTANCE_LEVELS } from "../constants";
import { isoDateIST } from "../dates";
import { dateReq, intStrOpt, opt, uuid } from "./common";

export const observationSchema = z
  .object({
    goalId: uuid,
    observedOn: dateReq.refine((v) => v <= isoDateIST(), "validation.dateFuture"),
    trialsTotal: intStrOpt(1, 500),
    trialsSuccessful: intStrOpt(0, 500),
    independentTrials: intStrOpt(0, 500),
    assistanceLevel: z.union([z.enum(ASSISTANCE_LEVELS), z.literal("")]),
    note: opt(2000),
  })
  .superRefine((v, ctx) => {
    if ((v.trialsTotal === "") !== (v.trialsSuccessful === "")) ctx.addIssue({ code: "custom", path: ["trialsSuccessful"], message: "validation.trialsPair" });
    else if (v.trialsTotal !== "" && +v.trialsSuccessful > +v.trialsTotal) ctx.addIssue({ code: "custom", path: ["trialsSuccessful"], message: "validation.trials" });
    if (v.independentTrials !== "" && (v.trialsSuccessful === "" || +v.independentTrials > +v.trialsSuccessful))
      ctx.addIssue({ code: "custom", path: ["independentTrials"], message: "validation.independentTrials" });
    if (v.trialsTotal === "" && v.assistanceLevel === "" && v.note.trim() === "") ctx.addIssue({ code: "custom", path: ["note"], message: "validation.required" });
  });
export type ObservationInput = z.infer<typeof observationSchema>;
