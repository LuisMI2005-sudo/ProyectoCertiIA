import { increment } from "./domain.js";
import type { User } from "./domain.js";

export interface Named {
  name: string;
}

export class Greeter {
  greet(user: User): string {
    return `Hello ${user.name}`;
  }
}

export function add(left: number, right: number): number {
  return left + right;
}

export const doubled = (value: number): number => {
  return value * 2;
};

export const label: string = "guardian";
export const result = add(increment(1), 2);

export function shadowed(): number {
  const add = (value: number): number => value;
  return add(3);
}

export const callback = { add };
