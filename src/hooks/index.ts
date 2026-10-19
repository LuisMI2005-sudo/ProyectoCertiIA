export * from "./types.js";
export * from "./registry.js";
export * from "./builtin-hooks.js";
export * from "./coordinator.js";
import { HookManager } from "./registry.js";
import { registerDefaultHooks } from "./builtin-hooks.js";
import type { HookConfig, HookPersistenceAdapter } from "./types.js";
export function createHookManager(config: Partial<HookConfig> = {}, adapter?: HookPersistenceAdapter): HookManager {
  return registerDefaultHooks(new HookManager(config, adapter));
}
