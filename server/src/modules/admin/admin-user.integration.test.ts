import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../auth/auth.service";
import { createAirlineStaff, CreateStaffError } from "./admin-user.service";

test("admin creates airline staff with a hashed password and audit entry", async t => {
  const actor = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" } });
  if (!actor) { t.skip("Cần admin đang hoạt động trong database kiểm thử."); return; }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  let airlineId: number | undefined;
  let staffId: number | undefined;
  try {
    const airline = await prisma.airline.create({ data: { code: `U${suffix}`, name: `Staff test ${suffix}` } });
    airlineId = airline.id;
    const input = { name: "Test Staff", email: `staff-${suffix}@example.test`, password: "staff-password-123", role: "AIRLINE_SALES_MANAGER" as const, airlineId, actorId: actor.id };
    const staff = await createAirlineStaff(input);
    staffId = staff.id;
    assert.equal(staff.role, "AIRLINE_SALES_MANAGER");
    assert.equal(staff.status, "ACTIVE");
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    assert.notEqual(saved.passwordHash, input.password);
    assert.equal(await verifyPassword(input.password, saved.passwordHash), true);
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "USER", entityId: String(staff.id), action: "CREATE_AIRLINE_STAFF" } });
    assert.equal(audit?.actorId, actor.id);
    assert.equal(JSON.stringify(audit?.after).includes(input.password), false);
    await assert.rejects(createAirlineStaff(input), (error: unknown) => error instanceof CreateStaffError && error.status === 409);
    await prisma.airline.update({ where: { id: airlineId }, data: { status: "LOCKED" } });
    await assert.rejects(createAirlineStaff({ ...input, email: `second-${suffix}@example.test` }), (error: unknown) => error instanceof CreateStaffError && error.status === 409);
  } finally {
    if (staffId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "USER", entityId: String(staffId), action: "CREATE_AIRLINE_STAFF" } });
      await prisma.user.delete({ where: { id: staffId } });
    }
    if (airlineId) await prisma.airline.delete({ where: { id: airlineId } });
    await prisma.$disconnect();
  }
});
