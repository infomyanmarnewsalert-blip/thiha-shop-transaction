export class UnauthorizedError extends Error {}

export function assertAdminAuth(request: Request): void {
  const token = request.headers.get("x-admin-token")
  if (!token || token !== process.env.ADMIN_TOKEN) {
    throw new UnauthorizedError("Unauthorized")
  }
}
