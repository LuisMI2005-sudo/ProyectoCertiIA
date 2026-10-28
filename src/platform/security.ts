import { randomUUID, sign, verify, createHash, scrypt as derive, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { ContextSchema, PlatformError, ServiceSchema } from "./contracts.js";
import type { PlatformConfig, ServiceName, TenantContext } from "./contracts.js";
const scrypt = promisify(derive);
const Claims = z.strictObject({ issuer: ServiceSchema, audience: ServiceSchema, expires: z.number().int(), issued: z.number().int(), nonce: z.uuid(), context: ContextSchema.nullable() });
export function issueServiceToken(config: PlatformConfig, issuer: ServiceName, audience: ServiceName, context: TenantContext | null): string {
  if (issuer !== config.service) throw new PlatformError(403, "INVALID_ISSUER", "No se puede suplantar otro servicio.");
  const issued = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ issuer, audience, issued, expires: issued + 60, nonce: randomUUID(), context })).toString("base64url");
  return `${body}.${sign(null, Buffer.from(body), config.signingKey).toString("base64url")}`;
}
export function verifyServiceToken(config: PlatformConfig, audience: ServiceName, token: string | undefined, allowed: readonly ServiceName[]): TenantContext | null {
  try {
    if (!token || token.length > 8192) throw new Error();
    const parts = token.split("."); if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error();
    const claims = Claims.parse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as unknown);
    const now = Math.floor(Date.now() / 1000);
    if (claims.audience !== audience || !allowed.includes(claims.issuer) || claims.expires <= now || claims.issued > now + 5 || claims.expires - claims.issued > 60 ||
      !verify(null, Buffer.from(parts[0]), config.services[claims.issuer].publicKey, Buffer.from(parts[1], "base64url"))) throw new Error();
    return claims.context;
  } catch { throw new PlatformError(401, "SERVICE_AUTH_REQUIRED", "Credencial interna inválida o caducada."); }
}
export const sessionHash = (token: string): string => createHash("sha256").update(token).digest("hex");
export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex"), key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected || !/^[a-f0-9]{128}$/u.test(expected)) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}
