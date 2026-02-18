import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Initializing production database...\n");

  // ==================== Clear all data ====================
  console.log("  Clearing all existing data...");
  await prisma.assignmentCompletion.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.eventSession.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.eventTeamTask.deleteMany();
  await prisma.eventTeamMember.deleteMany();
  await prisma.eventTeam.deleteMany();
  await prisma.teamDefaultTask.deleteMany();
  await prisma.teamDefaultMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.event.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  console.log("  ✅ All data cleared\n");

  // ==================== Create admin users ====================
  console.log("  Creating admin users...");

  const admin1 = await prisma.user.create({
    data: {
      name: "杜得人",
      email: "alexsui122@gmail.com",
      password: await hash("toh0989201706", 12),
      role: "ADMIN",
      isActive: true,
      profileCompleted: true,
    },
  });
  console.log(`    ✅ ${admin1.name} (${admin1.email})`);

  const admin2 = await prisma.user.create({
    data: {
      name: "沈智惠",
      email: "a0910683394@gmail.com",
      password: await hash("xuecheng60b1", 12),
      role: "ADMIN",
      isActive: true,
      profileCompleted: true,
    },
  });
  console.log(`    ✅ ${admin2.name} (${admin2.email})`);

  // ==================== Seed RolePermissions ====================
  console.log("\n  Seeding role permissions...");

  const modules = [
    "events", "registrations", "attendance", "assignments",
    "users", "teams", "budget", "reports",
  ] as const;
  const actions = ["read", "write"] as const;

  const defaultPermissions: Record<string, Record<string, string[]>> = {
    STAFF_ADMIN: {
      events: ["read", "write"],
      registrations: ["read", "write"],
      attendance: ["read", "write"],
      assignments: ["read"],
      users: ["read"],
      teams: ["read"],
      reports: ["read"],
    },
    STAFF_GENERAL: {
      events: ["read"],
      registrations: ["read"],
      budget: ["read", "write"],
      reports: ["read"],
    },
    STAFF_FINANCE: {
      events: ["read"],
      registrations: ["read"],
      budget: ["read", "write"],
      reports: ["read"],
    },
    PASTOR: {
      events: ["read"],
      registrations: ["read"],
      attendance: ["read"],
      assignments: ["read"],
      users: ["read"],
      teams: ["read"],
      reports: ["read"],
    },
    STAFF_MEDIA: {
      events: ["read"],
      teams: ["read"],
    },
    TEAM_LEADER: {
      events: ["read"],
      registrations: ["read"],
      attendance: ["read"],
      assignments: ["read"],
      teams: ["read"],
    },
    MEMBER: {
      events: ["read"],
      registrations: ["read"],
      attendance: ["read"],
      assignments: ["read"],
      users: ["read"],
    },
  };

  for (const [role, modulePerms] of Object.entries(defaultPermissions)) {
    for (const mod of modules) {
      for (const action of actions) {
        const allowed = modulePerms[mod]?.includes(action) ?? false;
        await prisma.rolePermission.upsert({
          where: {
            role_module_action: {
              role: role as any,
              module: mod,
              action,
            },
          },
          update: { allowed },
          create: {
            role: role as any,
            module: mod,
            action,
            allowed,
          },
        });
      }
    }
  }
  console.log("  ✅ Role permissions seeded\n");

  console.log("✅ Production database initialized!");
  console.log("\n📋 Admin accounts:");
  console.log("   1. 杜得人 — alexsui122@gmail.com");
  console.log("   2. 沈智惠 — a0910683394@gmail.com");
}

main()
  .catch((e) => {
    console.error("❌ Init failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
