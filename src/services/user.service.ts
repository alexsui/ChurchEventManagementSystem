import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { hash } from "bcryptjs";

export class UserServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "UserServiceError";
  }
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export async function registerUser(input: RegisterUserInput) {
  const { name, email, password, phone } = input;

  if (!name || !email || !password) {
    throw new UserServiceError("姓名、Email 及密碼為必填欄位", "MISSING_FIELDS");
  }

  if (!/^[\u4e00-\u9fff]{2,}$/.test(name.trim())) {
    throw new UserServiceError("姓名請輸入至少兩個中文字，不接受英文或其他字元", "INVALID_NAME");
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new UserServiceError("註冊失敗，請確認資料後重試", "DUPLICATE_USER");
  }

  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new UserServiceError("註冊失敗，請確認資料後重試", "DUPLICATE_USER");
    }
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      profileCompleted: true,
    },
  });

  return { userId: user.id };
}

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
      permissionExpiresAt: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      password: true,
      accounts: {
        select: { provider: true },
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
      permissionExpiresAt: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
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

export async function updateUserRole(id: string, role: Role, expiresAt?: Date | null) {
  const data: Record<string, unknown> = { role };

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
      permissionExpiresAt: true,
      isActive: true,
    },
  });

  return user;
}

export async function updateOwnProfile(userId: string, data: { name: string; phone?: string }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      phone: data.phone || undefined,
      profileCompleted: true,
    },
    select: { id: true, name: true, phone: true, profileCompleted: true },
  });
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
