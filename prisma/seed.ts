import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (order matters for FK constraints)
  await prisma.attendance.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.eventSession.deleteMany();
  await prisma.event.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.rolePermission.deleteMany();

  console.log("  Cleared existing data");

  // ==================== Teams ====================
  const worshipTeam = await prisma.team.create({
    data: { name: "敬拜組" },
  });
  const mediaTeam = await prisma.team.create({
    data: { name: "影音組" },
  });

  console.log("  Created teams");

  // ==================== Users ====================
  const passwordHash = await hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "王統籌",
      email: "admin@church.org",
      phone: "0912345678",
      password: passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  const staffAdmin = await prisma.user.create({
    data: {
      name: "李行政",
      email: "staff@church.org",
      phone: "0922345678",
      password: passwordHash,
      role: "STAFF_ADMIN",
      isActive: true,
    },
  });

  const pastor = await prisma.user.create({
    data: {
      name: "陳傳道",
      email: "pastor@church.org",
      phone: "0932345678",
      password: passwordHash,
      role: "PASTOR",
      isActive: true,
    },
  });

  const teamLeader = await prisma.user.create({
    data: {
      name: "張組長",
      email: "leader@church.org",
      phone: "0942345678",
      password: passwordHash,
      role: "TEAM_LEADER",
      teamId: worshipTeam.id,
      isActive: true,
    },
  });

  const members = await Promise.all([
    prisma.user.create({
      data: {
        name: "林小明",
        email: "ming@example.com",
        phone: "0952345678",
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "黃美玲",
        email: "meiling@example.com",
        phone: "0962345678",
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "劉大華",
        email: "dahua@example.com",
        phone: "0972345678",
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "趙雅婷",
        email: "yating@example.com",
        phone: "0982345678",
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "周志偉",
        email: "zhiwei@example.com",
        phone: "0992345678",
        password: passwordHash,
        role: "MEMBER",
        isActive: true,
      },
    }),
  ]);

  console.log("  Created 8 users (admin, staff, pastor, leader, 5 members)");

  // ==================== Events ====================

  // Single event — 主日崇拜特別聚會
  const singleEvent = await prisma.event.create({
    data: {
      title: "復活節特別聚會",
      description: "復活節主日特別聚會，歡迎邀請親朋好友一同參加。",
      location: "主堂",
      type: "SINGLE",
      status: "OPEN",
      registrationMode: "FULL_SERIES",
      maxParticipants: 200,
      eventSessions: {
        create: {
          sessionNo: 1,
          sessionDate: new Date("2026-04-05"),
          startTime: "10:00",
          endTime: "12:00",
          topic: "復活的盼望",
        },
      },
    },
    include: { eventSessions: true },
  });

  // Series event — 幸福小組
  const seriesEvent = await prisma.event.create({
    data: {
      title: "2026 春季幸福小組",
      description:
        "為期五週的幸福小組課程，帶領新朋友認識信仰。每週五晚間聚會。",
      location: "副堂 B 教室",
      type: "SERIES",
      status: "OPEN",
      registrationMode: "FULL_SERIES",
      maxParticipants: 30,
      eventSessions: {
        create: [
          {
            sessionNo: 1,
            sessionDate: new Date("2026-03-06"),
            startTime: "19:30",
            endTime: "21:00",
            topic: "歡迎你來",
          },
          {
            sessionNo: 2,
            sessionDate: new Date("2026-03-13"),
            startTime: "19:30",
            endTime: "21:00",
            topic: "認識自己",
          },
          {
            sessionNo: 3,
            sessionDate: new Date("2026-03-20"),
            startTime: "19:30",
            endTime: "21:00",
            topic: "生命的意義",
          },
          {
            sessionNo: 4,
            sessionDate: new Date("2026-03-27"),
            startTime: "19:30",
            endTime: "21:00",
            topic: "信仰與生活",
          },
          {
            sessionNo: 5,
            sessionDate: new Date("2026-04-03"),
            startTime: "19:30",
            endTime: "21:00",
            topic: "新的開始",
          },
        ],
      },
    },
    include: { eventSessions: true },
  });

  console.log("  Created 2 events (1 single, 1 series with 5 sessions)");

  // ==================== Registrations ====================

  // Register members and some staff for the single event
  const singleRegistrations = await Promise.all([
    ...members.map((m) =>
      prisma.registration.create({
        data: { userId: m.id, eventId: singleEvent.id, status: "REGISTERED" },
      })
    ),
    prisma.registration.create({
      data: {
        userId: teamLeader.id,
        eventId: singleEvent.id,
        status: "REGISTERED",
      },
    }),
    prisma.registration.create({
      data: {
        userId: pastor.id,
        eventId: singleEvent.id,
        status: "REGISTERED",
      },
    }),
  ]);

  // Register some members for the series event
  const seriesRegistrations = await Promise.all([
    prisma.registration.create({
      data: {
        userId: members[0].id,
        eventId: seriesEvent.id,
        status: "REGISTERED",
      },
    }),
    prisma.registration.create({
      data: {
        userId: members[1].id,
        eventId: seriesEvent.id,
        status: "REGISTERED",
      },
    }),
    prisma.registration.create({
      data: {
        userId: members[2].id,
        eventId: seriesEvent.id,
        status: "REGISTERED",
      },
    }),
    prisma.registration.create({
      data: {
        userId: members[3].id,
        eventId: seriesEvent.id,
        status: "WAITLISTED",
      },
    }),
  ]);

  console.log(
    `  Created ${singleRegistrations.length + seriesRegistrations.length} registrations`
  );

  // ==================== Attendance ====================

  // Attendance for the series event — first two sessions completed
  const session1 = seriesEvent.eventSessions[0];
  const session2 = seriesEvent.eventSessions[1];

  // Session 1: all 3 registered members attended
  await Promise.all([
    prisma.attendance.create({
      data: {
        userId: members[0].id,
        eventSessionId: session1.id,
        checkedInAt: new Date("2026-03-06T19:25:00"),
      },
    }),
    prisma.attendance.create({
      data: {
        userId: members[1].id,
        eventSessionId: session1.id,
        checkedInAt: new Date("2026-03-06T19:30:00"),
      },
    }),
    prisma.attendance.create({
      data: {
        userId: members[2].id,
        eventSessionId: session1.id,
        checkedInAt: new Date("2026-03-06T19:55:00"),
        isLate: true,
        lateMinutes: 25,
      },
    }),
  ]);

  // Session 2: 2 of 3 attended
  await Promise.all([
    prisma.attendance.create({
      data: {
        userId: members[0].id,
        eventSessionId: session2.id,
        checkedInAt: new Date("2026-03-13T19:28:00"),
      },
    }),
    prisma.attendance.create({
      data: {
        userId: members[2].id,
        eventSessionId: session2.id,
        checkedInAt: new Date("2026-03-13T19:30:00"),
      },
    }),
  ]);

  console.log("  Created 5 attendance records across 2 sessions");

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📋 Login credentials (all users):");
  console.log("   Password: password123");
  console.log("\n   Admin:    admin@church.org");
  console.log("   Staff:    staff@church.org");
  console.log("   Pastor:   pastor@church.org");
  console.log("   Leader:   leader@church.org");
  console.log("   Members:  ming@example.com, meiling@example.com,");
  console.log("             dahua@example.com, yating@example.com,");
  console.log("             zhiwei@example.com");

  // ==================== RolePermission ====================
  // Seed RolePermission table
  const modules = [
    "events", "registrations", "attendance", "assignments",
    "users", "teams", "budget", "reports",
  ] as const;
  const actions = ["read", "write"] as const;

  // Current default permissions (excluding ADMIN who always has full access)
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

  console.log("RolePermission seed complete");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
