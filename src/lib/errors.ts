/** Thrown by authz checks — kept dependency-free so importing it (e.g. from api-handler.ts) never drags in auth.ts/db.ts. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
