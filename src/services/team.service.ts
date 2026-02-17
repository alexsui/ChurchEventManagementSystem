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
    include: {
      _count: { select: { defaultMembers: true, defaultTasks: true } },
    },
  });
}

export async function getTeamTemplateWithDefaults(teamId: string) {
  const template = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      defaultMembers: {
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
      defaultTasks: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!template) {
    throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  }
  return template;
}

// ==================== Default Members ====================

export async function addDefaultMember(teamId: string, userId: string, role?: string) {
  const template = await prisma.team.findUnique({ where: { id: teamId } });
  if (!template) throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");

  return prisma.teamDefaultMember.create({
    data: { teamId, userId, role: role ?? null },
  });
}

export async function removeDefaultMember(teamId: string, userId: string) {
  const existing = await prisma.teamDefaultMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!existing) throw new TeamServiceError("Default member not found", "DEFAULT_MEMBER_NOT_FOUND");
  return prisma.teamDefaultMember.delete({ where: { id: existing.id } });
}

// ==================== Default Tasks ====================

export async function addDefaultTask(teamId: string, title: string) {
  const template = await prisma.team.findUnique({ where: { id: teamId } });
  if (!template) throw new TeamServiceError("Team template not found", "TEMPLATE_NOT_FOUND");
  return prisma.teamDefaultTask.create({ data: { teamId, title } });
}

export async function removeDefaultTask(taskId: string) {
  const existing = await prisma.teamDefaultTask.findUnique({ where: { id: taskId } });
  if (!existing) throw new TeamServiceError("Default task not found", "DEFAULT_TASK_NOT_FOUND");
  return prisma.teamDefaultTask.delete({ where: { id: taskId } });
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

  return prisma.$transaction(async (tx) => {
    const eventTeam = await tx.eventTeam.create({
      data: {
        eventId,
        teamId: input.teamId ?? null,
        customName: input.customName ?? null,
      },
    });

    // Copy defaults if creating from template
    if (input.teamId) {
      const [defaultMembers, defaultTasks] = await Promise.all([
        tx.teamDefaultMember.findMany({ where: { teamId: input.teamId } }),
        tx.teamDefaultTask.findMany({ where: { teamId: input.teamId } }),
      ]);

      if (defaultMembers.length > 0) {
        await tx.eventTeamMember.createMany({
          data: defaultMembers.map((m) => ({
            eventTeamId: eventTeam.id,
            userId: m.userId,
            role: m.role,
          })),
        });
      }

      if (defaultTasks.length > 0) {
        await tx.eventTeamTask.createMany({
          data: defaultTasks.map((t) => ({
            eventTeamId: eventTeam.id,
            title: t.title,
          })),
        });
      }
    }

    return eventTeam;
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
