/** Typed errors that are safe to surface to users as translated messages. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}
export class ForbiddenError extends AppError {
  constructor(detail?: string) {
    super("errors.forbidden", detail);
  }
}
export class NotFoundError extends AppError {
  constructor(detail?: string) {
    super("errors.notFound", detail);
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Maps a thrown error to a safe ActionResult (never leaks internals). */
export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.code };
  const pg = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = pg?.code ?? pg?.cause?.code;
  const constraint = pg?.constraint ?? pg?.cause?.constraint;
  if (code === "23P01") {
    return {
      ok: false,
      error: constraint?.includes("child") ? "errors.childDoubleBooked" : "errors.staffDoubleBooked",
    };
  }
  if (code === "23505") return { ok: false, error: "errors.duplicate" };
  if (code === "23514" || code === "22P02" || code === "22007") return { ok: false, error: "errors.invalidData" };
  if (code === "P0001") return { ok: false, error: "errors.recordLocked" };
  console.error("[careos] unexpected error", err);
  return { ok: false, error: "errors.unexpected" };
}
