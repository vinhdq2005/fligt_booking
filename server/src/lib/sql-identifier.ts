import { Prisma } from "../generated/prisma/client";
import { databaseProvider } from "./prisma";

// Only use with fixed identifiers in source code; query values remain parameters.
export function sqlIdentifier(name: string) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error("Invalid SQL identifier");
  return Prisma.raw(databaseProvider === "postgresql" ? `"${name}"` : `\`${name}\``);
}
