import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/auth.service";

export type StaffRole = "AIRLINE_FLIGHT_MANAGER" | "AIRLINE_SALES_MANAGER";
export type CreateStaffInput = { name: string; email: string; password: string; role: StaffRole; airlineId: number; actorId: number };

export class CreateStaffError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

export function parseCreateStaffInput(value: unknown, actorId: number): CreateStaffInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 120 ||
      email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof data.password !== "string" || data.password.length < 10 || data.password.length > 128 ||
      (data.role !== "AIRLINE_FLIGHT_MANAGER" && data.role !== "AIRLINE_SALES_MANAGER") ||
      !Number.isSafeInteger(data.airlineId) || Number(data.airlineId) < 1) return null;
  return { name, email, password: data.password, role: data.role, airlineId: Number(data.airlineId), actorId };
}

export async function createAirlineStaff(input: CreateStaffInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async tx => {
      // Serialize creation with airline locking so new staff cannot be activated for a locked airline.
      const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM Airline WHERE id = ${input.airlineId} FOR UPDATE`;
      if (!rows.length) throw new CreateStaffError(404, "Không tìm thấy hãng bay.");
      const airline = await tx.airline.findUniqueOrThrow({ where: { id: input.airlineId }, select: { status: true } });
      if (airline.status !== "ACTIVE") throw new CreateStaffError(409, "Hãng bay đang bị khóa.");
      const user = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, role: input.role, airlineId: input.airlineId, status: "ACTIVE" },
        select: { id: true, name: true, email: true, role: true, airlineId: true, status: true },
      });
      await tx.auditLog.create({ data: { actorId: input.actorId, action: "CREATE_AIRLINE_STAFF", entityType: "USER", entityId: String(user.id),
        after: { name: user.name, email: user.email, role: user.role, airlineId: user.airlineId, status: user.status }, result: "SUCCESS" } });
      return user;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002")
      throw new CreateStaffError(409, "Email đã được sử dụng.");
    throw error;
  }
}
