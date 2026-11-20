import "server-only";
import type { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { toActionError, type ActionResult } from "./errors";

/** Validates input with Zod and converts thrown errors into safe results. */
export async function runAction<S extends z.ZodType, R = undefined>(
  schema: S,
  input: unknown,
  fn: (data: z.output<S>) => Promise<ActionResult<R>>,
): Promise<ActionResult<R>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message.startsWith("validation.") ? issue.message : "validation.invalid";
    }
    return { ok: false, error: "errors.invalidData", fieldErrors };
  }
  try {
    return await fn(parsed.data);
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() propagate
    return toActionError(err);
  }
}

export { nn, intOrNull } from "./text";
