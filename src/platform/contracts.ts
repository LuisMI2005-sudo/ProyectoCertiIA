import { z } from "zod";

export const ServiceSchema = z.enum(["identity", "projects", "audits", "execution", "policies", "telemetry", "planner", "gateway"]);
export type ServiceName = z.infer<typeof ServiceSchema>;
export const Uuid = z.uuid();
export const ContextSchema = z.strictObject({ tenantId: Uuid, subjectId: Uuid, role: z.enum(["owner", "member", "viewer"]), correlationId: Uuid });
export type TenantContext = z.infer<typeof ContextSchema>;
export const PlatformConfigSchema = z.strictObject({
  version: z.literal(1), host: z.string().min(1), gatewayPort: z.number().int().min(1024).max(65520),
  service: ServiceSchema, signingKey: z.string().min(1), databaseUrl: z.string().optional(),
  services: z.record(ServiceSchema, z.strictObject({ port: z.number().int().min(1024).max(65535), publicKey: z.string().min(1) })),
  workspaceRoot: z.string().min(1), allowedOrigin: z.string().url()
});
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;
export const CredentialsSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(12).max(256) });
export const BootstrapSchema = CredentialsSchema.extend({ name: z.string().trim().min(1).max(120) });
export const CommandSchema = z.strictObject({ id: Uuid, operation: z.string().min(1).max(100), payload: z.json() });
export type Command = z.infer<typeof CommandSchema>;
export class PlatformError extends Error {
  public constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = "PlatformError"; }
}
export function requireWrite(context: TenantContext): void {
  if (context.role === "viewer") throw new PlatformError(403, "FORBIDDEN", "La organización te concede acceso de solo lectura.");
}
