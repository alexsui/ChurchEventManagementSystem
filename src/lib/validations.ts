import { z } from "zod/v4";

// ==================== Events ====================

const sessionSchema = z.object({
  sessionNo: z.number(),
  sessionDate: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  topic: z.string().optional(),
});

// ==================== Form Fields ====================

export const formFieldSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["TEXT", "YES_NO", "SINGLE_CHOICE"]),
    label: z.string().min(1, "欄位標籤為必填"),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional().default(false),
    sortOrder: z.number().int().min(0),
  })
  .refine(
    (data) => {
      if (data.type === "SINGLE_CHOICE") {
        return data.options && data.options.length >= 2;
      }
      return true;
    },
    { message: "單選題至少需要 2 個選項" }
  )
  .refine(
    (data) => {
      if (data.type === "SINGLE_CHOICE" && data.options) {
        return new Set(data.options).size === data.options.length;
      }
      return true;
    },
    { message: "選項不可重複" }
  );

export const formFieldsArraySchema = z.array(formFieldSchema).max(20, "最多 20 個欄位");

export const formResponseSchema = z.object({
  fieldId: z.string().min(1),
  value: z.string(),
});

export const formResponsesArraySchema = z.array(formResponseSchema);

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  category: z.enum(["COURSE", "LECTURE", "CAMP"]).optional(),
  type: z.enum(["SINGLE", "SERIES"]).optional(),
  maxParticipants: z.number().int().positive().optional(),
  minAssignmentRate: z.number().min(0).max(100).optional(),
  session: sessionSchema.optional(),
  sessions: z.array(sessionSchema).optional(),
  formFields: formFieldsArraySchema.optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  title: z.string().min(1).optional(),
  status: z.enum(["PLANNING", "OPEN", "IN_PROGRESS", "COMPLETED"]).optional(),
});

// ==================== Users ====================

export const updateUserSchema = z.union([
  z.object({
    action: z.literal("toggleActive"),
  }),
  z.object({
    role: z.enum([
      "ADMIN",
      "STAFF_ADMIN",
      "STAFF_GENERAL",
      "STAFF_FINANCE",
      "PASTOR",
      "STAFF_MEDIA",
      "TEAM_LEADER",
      "MEMBER",
    ]),
    expiresAt: z.string().optional(),
  }),
]);

// ==================== Budget ====================

export const createBudgetSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  category: z.string().min(1, "category is required"),
  customCategory: z.string().nullable().optional(),
  estimated: z.number({ message: "estimated must be a number" }),
  actual: z.number().optional().default(0),
  note: z.string().nullable().optional(),
});

export const updateBudgetSchema = z.object({
  category: z.string().optional(),
  customCategory: z.string().nullable().optional(),
  estimated: z.number().optional(),
  actual: z.number().optional(),
  note: z.string().nullable().optional(),
});

// ==================== Profile ====================

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "姓名為必填欄位")
    .regex(/^[\u4e00-\u9fff]{2,}$/, "姓名請輸入至少兩個中文字，不接受英文或其他字元"),
  phone: z.string().optional(),
});

// ==================== Tasks ====================

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  assigneeId: z.string().optional(),
  deadline: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.string().optional(),
  deadline: z.string().nullable().optional(),
});
