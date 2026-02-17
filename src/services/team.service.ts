import { prisma } from "@/lib/prisma";

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

export async function getTeamTemplates() {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createTeamTemplate(name: string) {
  return prisma.team.create({
    data: { name },
  });
}

export async function updateTeamTemplate(id: string, name: string) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }
  return prisma.team.update({
    where: { id },
    data: { name },
  });
}

export async function deleteTeamTemplate(id: string) {
  const existing = await prisma.team.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }
  return prisma.team.delete({ where: { id } });
}

// ==================== Event Teams ====================

export async function getEventTeams(eventId: string) {
  return prisma.eventTeam.findMany({
    where: { eventId },
    include: {
      team: true,
      members: {
        include: { user: { select: { id: true, name: true, phone: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createEventTeam(
  eventId: string,
  input: { teamId?: string; customName?: string }
) {
  if (!input.teamId && !input.customName) {
    throw new TeamServiceError(
      "Either teamId or customName is required",
      "INVALID_INPUT"
    );
  }

  return prisma.eventTeam.create({
    data: {
      eventId,
      teamId: input.teamId ?? null,
      customName: input.customName ?? null,
    },
  });
}

export async function updateEventTeam(
  id: string,
  data: { sopLinks?: string[]; customName?: string }
) {
  const existing = await prisma.eventTeam.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Event team not found", "EVENT_TEAM_NOT_FOUND");
  }

  return prisma.eventTeam.update({
    where: { id },
    data,
  });
}

export async function deleteEventTeam(id: string) {
  const existing = await prisma.eventTeam.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Event team not found", "EVENT_TEAM_NOT_FOUND");
  }

  return prisma.eventTeam.delete({ where: { id } });
}

// ==================== Event Team Members ====================

export async function addEventTeamMember(
  eventTeamId: string,
  userId: string,
  role?: string
) {
  return prisma.eventTeamMember.create({
    data: { eventTeamId, userId, role: role ?? null },
  });
}

export async function removeEventTeamMember(
  eventTeamId: string,
  userId: string
) {
  return prisma.eventTeamMember.deleteMany({
    where: { eventTeamId, userId },
  });
}

// ==================== Event Team Tasks ====================

export async function createEventTeamTask(
  eventTeamId: string,
  title: string,
  assigneeId?: string
) {
  return prisma.eventTeamTask.create({
    data: {
      eventTeamId,
      title,
      assigneeId: assigneeId ?? null,
    },
  });
}

export async function updateEventTeamTask(
  id: string,
  data: { title?: string; assigneeId?: string | null; status?: string }
) {
  const existing = await prisma.eventTeamTask.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Task not found", "TASK_NOT_FOUND");
  }

  return prisma.eventTeamTask.update({
    where: { id },
    data,
  });
}

export async function deleteEventTeamTask(id: string) {
  const existing = await prisma.eventTeamTask.findUnique({ where: { id } });
  if (!existing) {
    throw new TeamServiceError("Task not found", "TASK_NOT_FOUND");
  }

  return prisma.eventTeamTask.delete({ where: { id } });
}
