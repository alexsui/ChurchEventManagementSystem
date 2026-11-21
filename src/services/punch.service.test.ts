import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  punchActivity: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  punchMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  punchRecord: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    },
  },
}));

import { Prisma } from "@/generated/prisma/client";
import {
  taipeiToday,
  parseDateOnly,
  formatDateOnly,
  computePunchStats,
  createPunchActivity,
  addPunchMember,
  updatePunchMember,
  getPunchActivityDetail,
  getTodayStatus,
  punchToday,
  deletePunchDate,
  makeUpPunch,
  deletePunchRecord,
  PunchServiceError,
} from "./punch.service";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const activity = {
  id: "act-1",
  title: "2027 敬拜團團練",
  startDate: d("2027-01-01"),
  endDate: d("2027-12-31"),
};

// 2027-03-10 10:00 Taipei = 02:00 UTC
const NOW = new Date("2027-03-10T02:00:00.000Z");

function prismaUniqueError() {
  const Err = Prisma.PrismaClientKnownRequestError as unknown as new (
    message: string,
    opts: { code: string }
  ) => Error;
  return new Err("Unique constraint failed", { code: "P2002" });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(PunchServiceError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("punch.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("taipeiToday", () => {
    it("returns the Taipei calendar date, not the UTC date", () => {
      // 2027-01-01 16:30 UTC is 2027-01-02 00:30 in Taipei
      expect(taipeiToday(new Date("2027-01-01T16:30:00.000Z"))).toBe("2027-01-02");
      // 2027-01-01 15:59 UTC is still 2027-01-01 23:59 in Taipei
      expect(taipeiToday(new Date("2027-01-01T15:59:00.000Z"))).toBe("2027-01-01");
    });
  });

  describe("parseDateOnly / formatDateOnly", () => {
    it("round-trips a valid date", () => {
      const date = parseDateOnly("2027-02-28");
      expect(date.toISOString()).toBe("2027-02-28T00:00:00.000Z");
      expect(formatDateOnly(date)).toBe("2027-02-28");
    });

    it.each(["", "2027/01/01", "2027-1-1", "2027-02-30", "2027-13-01", "abc"])(
      "rejects %j",
      (value) => {
        expect(() => parseDateOnly(value)).toThrow(PunchServiceError);
      }
    );
  });

  describe("computePunchStats", () => {
    const dates = ["2027-01-05", "2027-01-12", "2027-02-02", "2027-03-02"];

    it("counts all rehearsals for a member who joined before the activity", () => {
      const stats = computePunchStats(dates, {
        joinedOn: "2026-12-15",
        leftOn: null,
        punchedDates: ["2027-01-05", "2027-02-02", "2027-03-02"],
      });
      expect(stats).toEqual({
        attendedDates: ["2027-01-05", "2027-02-02", "2027-03-02"],
        attended: 3,
        eligible: 4,
        rate: 0.75,
      });
    });

    it("only counts rehearsals on or after the join date for a mid-year joiner", () => {
      const stats = computePunchStats(dates, {
        joinedOn: "2027-02-02",
        leftOn: null,
        punchedDates: ["2027-02-02", "2027-03-02"],
      });
      expect(stats.eligible).toBe(2);
      expect(stats.attended).toBe(2);
      expect(stats.rate).toBe(1);
    });

    it("stops counting after the leave date (inclusive)", () => {
      const stats = computePunchStats(dates, {
        joinedOn: "2026-12-01",
        leftOn: "2027-01-12",
        punchedDates: ["2027-01-12"],
      });
      expect(stats.eligible).toBe(2);
      expect(stats.attended).toBe(1);
      expect(stats.rate).toBe(0.5);
    });

    it("ignores punches outside the membership window", () => {
      const stats = computePunchStats(dates, {
        joinedOn: "2027-02-01",
        leftOn: null,
        punchedDates: ["2027-01-05", "2027-02-02"],
      });
      expect(stats.attendedDates).toEqual(["2027-02-02"]);
      expect(stats.attended).toBe(1);
      expect(stats.eligible).toBe(2);
    });

    it("returns a null rate when there are no eligible rehearsals", () => {
      const stats = computePunchStats(dates, {
        joinedOn: "2027-06-01",
        leftOn: null,
        punchedDates: [],
      });
      expect(stats).toEqual({ attendedDates: [], attended: 0, eligible: 0, rate: null });
    });
  });

  describe("createPunchActivity", () => {
    it("rejects an empty title", async () => {
      await expectCode(
        createPunchActivity({ title: "  ", startDate: "2027-01-01", endDate: "2027-12-31" }),
        "INVALID_INPUT"
      );
    });

    it("rejects an end date before the start date", async () => {
      await expectCode(
        createPunchActivity({ title: "x", startDate: "2027-12-31", endDate: "2027-01-01" }),
        "INVALID_INPUT"
      );
    });

    it("creates an activity with date-only values", async () => {
      mockPrisma.punchActivity.create.mockResolvedValue(activity);
      await createPunchActivity({
        title: " 2027 敬拜團團練 ",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      });
      expect(mockPrisma.punchActivity.create).toHaveBeenCalledWith({
        data: { title: "2027 敬拜團團練", startDate: d("2027-01-01"), endDate: d("2027-12-31") },
      });
    });
  });

  describe("addPunchMember", () => {
    it("throws NOT_FOUND when the activity does not exist", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(null);
      await expectCode(
        addPunchMember("missing", { userId: "u1", joinedOn: "2027-01-01" }),
        "NOT_FOUND"
      );
    });

    it("throws USER_NOT_FOUND when the user does not exist", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expectCode(
        addPunchMember("act-1", { userId: "ghost", joinedOn: "2027-01-01" }),
        "USER_NOT_FOUND"
      );
    });

    it("throws ALREADY_MEMBER on a duplicate", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
      mockPrisma.punchMember.create.mockRejectedValue(prismaUniqueError());
      await expectCode(
        addPunchMember("act-1", { userId: "u1", joinedOn: "2027-01-01" }),
        "ALREADY_MEMBER"
      );
    });
  });

  describe("updatePunchMember", () => {
    it("rejects a leave date before the join date", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue({ id: "m1" });
      await expectCode(
        updatePunchMember("act-1", "m1", { joinedOn: "2027-03-01", leftOn: "2027-02-01" }),
        "INVALID_INPUT"
      );
    });

    it("throws MEMBER_NOT_FOUND for a member of another activity", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue(null);
      await expectCode(
        updatePunchMember("act-1", "m-other", { joinedOn: "2027-01-01", leftOn: null }),
        "MEMBER_NOT_FOUND"
      );
    });
  });

  describe("getPunchActivityDetail", () => {
    it("derives rehearsal dates from records and computes per-member stats", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue({
        ...activity,
        members: [
          {
            id: "m1",
            userId: "u1",
            joinedOn: d("2026-12-01"),
            leftOn: null,
            user: { name: "劉大華", phone: "0972345678" },
            records: [{ date: d("2027-01-05") }, { date: d("2027-01-12") }],
          },
          {
            id: "m2",
            userId: "u2",
            joinedOn: d("2027-01-10"),
            leftOn: null,
            user: { name: "趙雅婷", phone: null },
            records: [{ date: d("2027-01-12") }],
          },
        ],
      });

      const detail = await getPunchActivityDetail("act-1");

      expect(detail.startDate).toBe("2027-01-01");
      expect(detail.dates).toEqual([
        { date: "2027-01-05", count: 1 },
        { date: "2027-01-12", count: 2 },
      ]);
      expect(detail.members[0]).toMatchObject({
        name: "劉大華",
        attended: 2,
        eligible: 2,
        rate: 1,
      });
      expect(detail.members[1]).toMatchObject({
        name: "趙雅婷",
        joinedOn: "2027-01-10",
        attended: 1,
        eligible: 1,
        rate: 1,
      });
    });

    it("lists each member's records, marking admin make-up punches", async () => {
      const punchedAt = new Date("2027-01-05T11:00:00.000Z");
      mockPrisma.punchActivity.findUnique.mockResolvedValue({
        ...activity,
        members: [
          {
            id: "m1",
            userId: "u1",
            joinedOn: d("2027-01-01"),
            leftOn: null,
            user: { name: "劉大華", phone: null },
            records: [
              { id: "r2", date: d("2027-01-12"), punchedAt, punchedBy: { name: "Grace" } },
              { id: "r1", date: d("2027-01-05"), punchedAt, punchedBy: null },
            ],
          },
        ],
      });

      const detail = await getPunchActivityDetail("act-1");

      expect(detail.members[0].records).toEqual([
        { id: "r2", date: "2027-01-12", punchedAt, punchedBy: { name: "Grace" } },
        { id: "r1", date: "2027-01-05", punchedAt, punchedBy: null },
      ]);
    });
  });

  describe("getTodayStatus", () => {
    it("returns NOT_LOGGED_IN without a user", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      const result = await getTodayStatus("act-1", undefined, NOW);
      expect(result.status).toBe("NOT_LOGGED_IN");
      expect(result.today).toBe("2027-03-10");
      expect(result.activity).toEqual({
        id: "act-1",
        title: "2027 敬拜團團練",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      });
    });

    it("returns PUNCHED with the time when already punched today", async () => {
      const punchedAt = new Date("2027-03-10T01:00:00.000Z");
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-01-01"),
        leftOn: null,
      });
      mockPrisma.punchRecord.findUnique.mockResolvedValue({ punchedAt });
      const result = await getTodayStatus("act-1", "u1", NOW);
      expect(result.status).toBe("PUNCHED");
      expect(result.punchedAt).toEqual(punchedAt);
    });

    it("returns READY for an active member who has not punched", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-01-01"),
        leftOn: null,
      });
      mockPrisma.punchRecord.findUnique.mockResolvedValue(null);
      const result = await getTodayStatus("act-1", "u1", NOW);
      expect(result.status).toBe("READY");
    });
  });

  describe("punchToday", () => {
    it("throws NOT_FOUND when the activity does not exist", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(null);
      await expectCode(punchToday("missing", "u1", NOW), "NOT_FOUND");
    });

    it("throws OUT_OF_RANGE before the activity starts", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      await expectCode(
        punchToday("act-1", "u1", new Date("2026-12-31T02:00:00.000Z")),
        "OUT_OF_RANGE"
      );
    });

    it("throws NOT_MEMBER when the user is not on the roster", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue(null);
      await expectCode(punchToday("act-1", "u1", NOW), "NOT_MEMBER");
    });

    it("throws NOT_MEMBER when the member joins in the future", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-04-01"),
        leftOn: null,
      });
      await expectCode(punchToday("act-1", "u1", NOW), "NOT_MEMBER");
    });

    it("throws NOT_MEMBER when the member has left", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-01-01"),
        leftOn: d("2027-03-09"),
      });
      await expectCode(punchToday("act-1", "u1", NOW), "NOT_MEMBER");
    });

    it("records today's Taipei date for an active member", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-01-01"),
        leftOn: d("2027-03-10"),
      });
      mockPrisma.punchRecord.create.mockResolvedValue({ id: "r1" });

      await punchToday("act-1", "u1", NOW);

      expect(mockPrisma.punchMember.findUnique).toHaveBeenCalledWith({
        where: { activityId_userId: { activityId: "act-1", userId: "u1" } },
      });
      expect(mockPrisma.punchRecord.create).toHaveBeenCalledWith({
        data: { memberId: "m1", date: d("2027-03-10") },
      });
    });

    it("throws ALREADY_PUNCHED on a second punch the same day", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findUnique.mockResolvedValue({
        id: "m1",
        joinedOn: d("2027-01-01"),
        leftOn: null,
      });
      mockPrisma.punchRecord.create.mockRejectedValue(prismaUniqueError());
      await expectCode(punchToday("act-1", "u1", NOW), "ALREADY_PUNCHED");
    });
  });

  describe("deletePunchDate", () => {
    it("deletes all records of the activity on that date", async () => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchRecord.deleteMany.mockResolvedValue({ count: 3 });
      const result = await deletePunchDate("act-1", "2027-03-10");
      expect(mockPrisma.punchRecord.deleteMany).toHaveBeenCalledWith({
        where: { date: d("2027-03-10"), member: { activityId: "act-1" } },
      });
      expect(result).toEqual({ count: 3 });
    });

    it("rejects an invalid date", async () => {
      await expectCode(deletePunchDate("act-1", "2027-02-30"), "INVALID_DATE");
    });
  });

  describe("makeUpPunch", () => {
    const member = {
      id: "m1",
      activityId: "act-1",
      joinedOn: d("2027-01-10"),
      leftOn: d("2027-06-30"),
    };

    beforeEach(() => {
      mockPrisma.punchActivity.findUnique.mockResolvedValue(activity);
      mockPrisma.punchMember.findFirst.mockResolvedValue(member);
    });

    it("throws MEMBER_NOT_FOUND for a member of another activity", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue(null);
      await expectCode(
        makeUpPunch("act-1", "m9", "2027-03-01", "admin-1", NOW),
        "MEMBER_NOT_FOUND"
      );
    });

    it("rejects an invalid date", async () => {
      await expectCode(makeUpPunch("act-1", "m1", "2027-02-30", "admin-1", NOW), "INVALID_DATE");
    });

    it("throws OUT_OF_RANGE for a date outside the activity period", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue({ ...member, joinedOn: d("2026-01-01") });
      await expectCode(makeUpPunch("act-1", "m1", "2026-12-31", "admin-1", NOW), "OUT_OF_RANGE");
    });

    it("throws FUTURE_DATE for a date after today (Taipei)", async () => {
      await expectCode(makeUpPunch("act-1", "m1", "2027-03-11", "admin-1", NOW), "FUTURE_DATE");
    });

    it("throws NOT_ON_ROSTER before the join date", async () => {
      await expectCode(makeUpPunch("act-1", "m1", "2027-01-09", "admin-1", NOW), "NOT_ON_ROSTER");
    });

    it("throws NOT_ON_ROSTER after the leave date", async () => {
      const later = new Date("2027-08-01T02:00:00.000Z");
      await expectCode(makeUpPunch("act-1", "m1", "2027-07-01", "admin-1", later), "NOT_ON_ROSTER");
    });

    it("creates a record on that date, attributed to the admin", async () => {
      mockPrisma.punchRecord.create.mockResolvedValue({ id: "r1" });

      await makeUpPunch("act-1", "m1", "2027-03-10", "admin-1", NOW);

      expect(mockPrisma.punchMember.findFirst).toHaveBeenCalledWith({
        where: { id: "m1", activityId: "act-1" },
      });
      expect(mockPrisma.punchRecord.create).toHaveBeenCalledWith({
        data: { memberId: "m1", date: d("2027-03-10"), punchedById: "admin-1" },
      });
    });

    it("throws ALREADY_PUNCHED when the member already has a record that day", async () => {
      mockPrisma.punchRecord.create.mockRejectedValue(prismaUniqueError());
      await expectCode(makeUpPunch("act-1", "m1", "2027-03-01", "admin-1", NOW), "ALREADY_PUNCHED");
    });
  });

  describe("deletePunchRecord", () => {
    it("deletes the record only within that member", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue({ id: "m1" });
      mockPrisma.punchRecord.deleteMany.mockResolvedValue({ count: 1 });

      await deletePunchRecord("act-1", "m1", "r1");

      expect(mockPrisma.punchRecord.deleteMany).toHaveBeenCalledWith({
        where: { id: "r1", memberId: "m1" },
      });
    });

    it("throws MEMBER_NOT_FOUND for a member of another activity", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue(null);
      await expectCode(deletePunchRecord("act-1", "m9", "r1"), "MEMBER_NOT_FOUND");
    });

    it("throws RECORD_NOT_FOUND when the record is not this member's", async () => {
      mockPrisma.punchMember.findFirst.mockResolvedValue({ id: "m1" });
      mockPrisma.punchRecord.deleteMany.mockResolvedValue({ count: 0 });
      await expectCode(deletePunchRecord("act-1", "m1", "r9"), "RECORD_NOT_FOUND");
    });
  });
});
