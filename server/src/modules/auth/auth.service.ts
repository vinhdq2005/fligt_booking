import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "../../lib/prisma";

const scrypt = promisify(scryptCallback);
export const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type Role = "ADMIN" | "CUSTOMER" | "AIRLINE_FLIGHT_MANAGER" | "AIRLINE_SALES_MANAGER";
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "LOCKED";
  airlineId: number | null;
  phone: string | null;
  airline: { status: "ACTIVE" | "LOCKED" } | null;
};

export interface AuthStore {
  findByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null>;
  findBySession(sessionHash: string): Promise<{ user: AuthUser; expiresAt: Date } | null>;
  createCustomer(input: { name: string; email: string; passwordHash: string }): Promise<AuthUser>;
  createSession(input: { id: string; userId: number; expiresAt: Date }): Promise<void>;
  deleteSession(id: string): Promise<void>;
  recordLogin(userId: number): Promise<void>;
  updateProfile(userId: number, data: { name: string; phone: string | null }): Promise<AuthUser>;
}

const userInclude = { airline: { select: { status: true } } } as const;

export const authStore: AuthStore = {
  findByEmail: (email) => prisma.user.findUnique({ where: { email }, include: userInclude }),
  findBySession: (id) => prisma.authSession.findUnique({ where: { id }, include: { user: { include: userInclude } } }),
  createCustomer: (data) => prisma.user.create({ data: { ...data, role: "CUSTOMER" }, include: userInclude }),
  async createSession(data) { await prisma.authSession.create({ data }); },
  async deleteSession(id) { await prisma.authSession.deleteMany({ where: { id } }); },
  async recordLogin(id) { await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }); },
  updateProfile: (id, data) => prisma.user.update({ where: { id }, data, include: userInclude }),
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, hex] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const expected = Buffer.from(hex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, actual);
}

export function hashSession(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function publicUser(user: AuthUser) {
  const { id, name, email, role, airlineId, phone } = user;
  return { id, name, email, role, airlineId, phone };
}

export function canUseAccount(user: AuthUser): boolean {
  return user.status === "ACTIVE" &&
    (!(user.role === "AIRLINE_FLIGHT_MANAGER" || user.role === "AIRLINE_SALES_MANAGER") ||
      (user.airlineId !== null && user.airline?.status === "ACTIVE"));
}
