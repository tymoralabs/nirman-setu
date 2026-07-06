import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, ForbiddenError, NotFoundError } from "@/lib/authz";
import { ServiceError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wrap a server-action body: maps NotFoundError → notFound() (cross-tenant
 * stays a 404, §7.3), ServiceError/LimitError → `{ ok:false, error }` for
 * toasts, everything else rethrows to the error boundary.
 */
export async function runAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof AuthError) {
      return { ok: false, error: "Your session has expired. Sign in again." };
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "This action is not available in read-only support mode." };
    }
    if (err instanceof ServiceError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues[0]?.message ?? "Invalid input." };
    }
    throw err;
  }
}

/**
 * Wrap a service call made from a server component: NotFoundError → 404 page,
 * AuthError → login redirect.
 */
export async function forPage<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
}
