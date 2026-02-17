import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";

export interface GetUsersFilters {
  role?: Role;
  isActive?: boolean;
  search?: string;
}

export async function getUsers(filters?: GetUsersFilters) {
  const where: Record<string, unknown> = {};

  if (filters?.role) {
    where.role = filters.role;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      teamId: true,
      permissionExpiresAt: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      teamId: true,
      permissionExpiresAt: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      registrations: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          event: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return user;
}

export async function updateUserRole(
  id: string,
  role: Role,
  teamId?: string | null,
  expiresAt?: Date | null
) {
  const data: Record<string, unknown> = { role };

  if (teamId !== undefined) {
    data.teamId = teamId;
  }

  if (expiresAt !== undefined) {
    data.permissionExpiresAt = expiresAt;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      teamId: true,
      permissionExpiresAt: true,
      isActive: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return user;
}

export async function toggleUserActive(id: string) {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!existing) {
    return null;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  return user;
}
