import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { assertSafeForProductionInit } from "./db-safety";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const fixedAdmins = [
  {
    name: "杜得人",
    email: "alexsui122@gmail.com",
    password: "toh0989201706",
  },
  {
    name: "沈智惠",
    email: "a0910683394@gmail.com",
    password: "xuecheng60b1",
  },
] as const;

const modules = [
  "events",
  "registrations",
  "attendance",
  "assignments",
  "users",
  "teams",
  "budget",
  "reports",
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
  MEMBER: {},
};

async function upsertFixedAdmins() {
  console.log("  Ensuring fixed admin users exist...");

  for (const admin of fixedAdmins) {
    const passwordHash = await hash(admin.password, 12);
    const row = await prisma.user.upsert({
      where: { email: admin.email },
      update: {
        name: admin.name,
        password: passwordHash,
        role: "ADMIN",
        isActive: true,
        profileCompleted: true,
      },
      create: {
        name: admin.name,
        email: admin.email,
        password: passwordHash,
        role: "ADMIN",
        isActive: true,
        profileCompleted: true,
      },
    });
    console.log(`    ✅ ${row.name} (${row.email})`);
  }
}

async function upsertRolePermissions() {
  console.log("  Ensuring role permissions exist...");
  await prisma.$transaction(async (tx) => {
    for (const [role, modulePerms] of Object.entries(defaultPermissions)) {
      const typedRole = role as Role;
      for (const moduleName of modules) {
        for (const action of actions) {
          const allowed = modulePerms[moduleName]?.includes(action) ?? false;
          await tx.rolePermission.upsert({
            where: {
              role_module_action: {
                role: typedRole,
                module: moduleName,
                action,
              },
            },
            update: { allowed },
            create: {
              role: typedRole,
              module: moduleName,
              action,
              allowed,
            },
          });
        }
      }
    }
  });
  console.log("    ✅ Role permissions upserted");
}

async function main() {
  const target = assertSafeForProductionInit("prisma/init-production.ts");
  console.log(
    `🚀 Running production bootstrap (host: ${target.host ?? "unknown"}, local: ${target.isLocal})...\n`
  );

  await upsertFixedAdmins();
  await upsertRolePermissions();

  console.log("\n✅ Production bootstrap completed (idempotent, non-destructive).");
}

main()
  .catch((e) => {
    console.error("❌ Init failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
