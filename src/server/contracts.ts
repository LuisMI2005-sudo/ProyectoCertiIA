import { z } from "zod";
import { IdentifierSchema, RelativePathSchema } from "../shared/contracts.js";
import { ProjectRecordSchema } from "../db/types.js";
import { RepairRequestSchema } from "../subagents/coordinator.js";
import { DevGuardianError, ErrorCode } from "../shared/errors.js";

export const RegisterProjectSchema = ProjectRecordSchema.omit({ id: true, createdAt: true });
export const RunAuditSchema = z.discriminatedUnion("mode", [
  z.strictObject({ projectId: IdentifierSchema, mode: z.literal("diagnose"), path: RelativePathSchema }),
  z.strictObject({ projectId: IdentifierSchema, mode: z.literal("repair"), repair: RepairRequestSchema })
]);
export const EvaluateHookSchema = z.strictObject({
  projectId: IdentifierSchema, files: z.array(RelativePathSchema).min(1).max(200),
  unifiedDiff: z.string().min(1).max(1_000_000)
});
export const ListQuerySchema = z.strictObject({
  projectId: IdentifierSchema.optional(), auditId: IdentifierSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100), offset: z.coerce.number().int().min(0).max(100000).default(0)
});
export type ListQuery = z.infer<typeof ListQuerySchema>;
export class HttpError extends DevGuardianError {
  public constructor(public readonly status: number, message: string, code: ErrorCode = ErrorCode.VALIDATION_ERROR) { super(code, message); }
}
