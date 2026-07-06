/**
 * ServiceError: a business-rule failure whose message is safe to show to the
 * end user (e.g. duplicate phone, plan limit reached). Server actions map
 * these to `{ ok: false, error }` results rendered as toasts; anything else
 * bubbles to the error boundary.
 */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}
