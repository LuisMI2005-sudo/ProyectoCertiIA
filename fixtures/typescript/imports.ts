import { increment } from "./domain.js";
import type { User } from "./domain.js";
export { increment as next } from "./domain.js";
export type { User as Person } from "./domain.js";

export async function load(): Promise<number> {
  const domain = await import("./domain.js");
  return domain.increment(increment(1));
}

export type LocalUser = User;
export type ImportedUser = import("./domain.js").User;
