import "dotenv/config";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { EventStatus, RegistrationStatus, Role, type User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cancelRegistration, registerForEvent } from "@/services/registration.service";

type TestState = {
  userIds: string[];
  eventIds: string[];
  registrationIds: string[];
};

const state: TestState = {
  userIds: [],
  eventIds: [],
  registrationIds: [],
};

const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "postgres",
  "db",
  "host.docker.internal",
]);

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const host = new URL(databaseUrl).hostname.toLowerCase();
  const isPrivateIp =
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  const isLocal = localHosts.has(host) || host.endsWith(".local") || isPrivateIp;

  if (!isLocal) {
    throw new Error(`Refusing to run integration tests against non-local DB host: ${host}`);
  }
}

function suffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser(
  input: {
    name?: string;
    role?: Role;
  } = {}
): Promise<User> {
  const s = suffix();
  const user = await prisma.user.create({
    data: {
      name: input.name ?? `Integration User ${s}`,
      email: `integration-${s}@example.com`,
      phone: `09${Math.floor(Math.random() * 1_0000_0000)
        .toString()
        .padStart(8, "0")}`,
      password: "hash-not-used-in-test",
      role: input.role ?? Role.MEMBER,
      isActive: true,
      profileCompleted: true,
    },
  });
  state.userIds.push(user.id);
  return user;
}

async function createEvent(input: { status?: EventStatus; maxParticipants?: number | null }) {
  const s = suffix();
  const event = await prisma.event.create({
    data: {
      title: `Integration Event ${s}`,
      status: input.status ?? EventStatus.OPEN,
      maxParticipants: input.maxParticipants === undefined ? null : input.maxParticipants,
    },
  });
  state.eventIds.push(event.id);
  return event;
}

async function trackRegistration(userId: string, eventId: string) {
  const row = await prisma.registration.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
  if (row) {
    state.registrationIds.push(row.id);
  }
  return row;
}

describe("registration.service integration", () => {
  beforeAll(() => {
    assertLocalDatabase();
  });

  afterEach(async () => {
    if (state.registrationIds.length > 0) {
      await prisma.registration.deleteMany({
        where: { id: { in: state.registrationIds } },
      });
    }
    if (state.eventIds.length > 0) {
      await prisma.event.deleteMany({
        where: { id: { in: state.eventIds } },
      });
    }
    if (state.userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: state.userIds } },
      });
    }

    state.registrationIds = [];
    state.eventIds = [];
    state.userIds = [];
  });

  it("creates REGISTERED when event is OPEN and has capacity", async () => {
    const user = await createUser();
    const event = await createEvent({ status: EventStatus.OPEN });

    const registration = await registerForEvent(user.id, event.id);
    state.registrationIds.push(registration.id);

    expect(registration.status).toBe(RegistrationStatus.REGISTERED);
  });

  it("creates WAITLISTED when event is full", async () => {
    const event = await createEvent({
      status: EventStatus.OPEN,
      maxParticipants: 1,
    });
    const firstUser = await createUser();
    const secondUser = await createUser();

    const first = await registerForEvent(firstUser.id, event.id);
    const second = await registerForEvent(secondUser.id, event.id);
    state.registrationIds.push(first.id, second.id);

    expect(first.status).toBe(RegistrationStatus.REGISTERED);
    expect(second.status).toBe(RegistrationStatus.WAITLISTED);
  });

  it("promotes waitlisted registration when a registered user cancels", async () => {
    const event = await createEvent({
      status: EventStatus.OPEN,
      maxParticipants: 1,
    });
    const registeredUser = await createUser();
    const waitlistedUser = await createUser();

    const registered = await registerForEvent(registeredUser.id, event.id);
    const waitlisted = await registerForEvent(waitlistedUser.id, event.id);
    state.registrationIds.push(registered.id, waitlisted.id);

    await cancelRegistration(registeredUser.id, event.id);

    const refreshedWaitlisted = await trackRegistration(waitlistedUser.id, event.id);
    expect(refreshedWaitlisted?.status).toBe(RegistrationStatus.REGISTERED);
  });

  it("throws EVENT_NOT_OPEN when event is not open for registration", async () => {
    const user = await createUser();
    const event = await createEvent({ status: EventStatus.PLANNING });

    await expect(registerForEvent(user.id, event.id)).rejects.toMatchObject({
      code: "EVENT_NOT_OPEN",
    });
  });
});
