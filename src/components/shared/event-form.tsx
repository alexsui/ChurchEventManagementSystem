"use client";

import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { eventCategoryLabels, eventTypeLabels } from "@/lib/constants";

// ==================== Schema ====================

const sessionSchema = z
  .object({
    sessionDate: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    topic: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    { message: "結束時間必須晚於開始時間", path: ["endTime"] }
  );

const eventFormSchema = z
  .object({
    title: z.string().min(1, "請輸入活動名稱"),
    description: z.string().optional(),
    location: z.string().optional(),
    category: z.enum(["COURSE", "LECTURE", "CAMP"], { error: "請選擇活動類別" }),
    type: z.enum(["SINGLE", "SERIES"]),
    maxParticipants: z.number().int().positive().optional(),
    minAssignmentRate: z.number().min(0).max(100).optional(),
    // SINGLE event session
    session: sessionSchema.optional(),
    // SERIES event sessions
    sessions: z.array(sessionSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.type === "SINGLE") {
        return data.session && data.session.sessionDate.length > 0;
      }
      return true;
    },
    { message: "單場活動需要填寫場次日期", path: ["session", "sessionDate"] }
  )
  .refine(
    (data) => {
      if (data.type === "SERIES") {
        return (
          data.sessions &&
          data.sessions.length > 0 &&
          data.sessions.every((s) => s.sessionDate.length > 0)
        );
      }
      return true;
    },
    { message: "系列活動每個場次都需要填寫日期", path: ["sessions"] }
  );

// Manual type definition to avoid zod v4 inference issues with @hookform/resolvers
interface EventFormValues {
  title: string;
  description?: string;
  location?: string;
  category?: "COURSE" | "LECTURE" | "CAMP";
  type: "SINGLE" | "SERIES";
  maxParticipants?: number;
  minAssignmentRate?: number;
  session?: {
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  };
  sessions?: {
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  }[];
}

// ==================== Types ====================

export interface EventFormDefaultValues {
  title?: string;
  description?: string;
  location?: string;
  category?: "COURSE" | "LECTURE" | "CAMP"; // optional for defaults since edit may pre-fill
  type?: "SINGLE" | "SERIES";
  minAssignmentRate?: number | null;
  maxParticipants?: number | null;
  session?: {
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  };
  sessions?: {
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  }[];
}

export interface EventFormSubmitData {
  title: string;
  description?: string;
  location?: string;
  category: "COURSE" | "LECTURE" | "CAMP";
  type: "SINGLE" | "SERIES";
  maxParticipants?: number;
  minAssignmentRate?: number;
  session?: {
    sessionNo: number;
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  };
  sessions?: {
    sessionNo: number;
    sessionDate: string;
    startTime?: string;
    endTime?: string;
    topic?: string;
  }[];
}

interface EventFormProps {
  mode: "create" | "edit";
  defaultValues?: EventFormDefaultValues;
  onSubmit: (data: EventFormSubmitData) => void | Promise<void>;
  isSubmitting?: boolean;
}

// ==================== Component ====================

export function EventForm({
  mode,
  defaultValues,
  onSubmit,
  isSubmitting = false,
}: EventFormProps) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema) as unknown as Resolver<EventFormValues>,
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      location: defaultValues?.location ?? "",
      category: defaultValues?.category ?? undefined,
      type: defaultValues?.type ?? "SINGLE",
      maxParticipants: defaultValues?.maxParticipants ?? undefined,
      minAssignmentRate: defaultValues?.minAssignmentRate ?? undefined,
      session: defaultValues?.session ?? {
        sessionDate: "",
        startTime: "",
        endTime: "",
        topic: "",
      },
      sessions: defaultValues?.sessions ?? [
        { sessionDate: "", startTime: "", endTime: "", topic: "" },
      ],
    },
  });

  const eventType = form.watch("type");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sessions",
  });

  async function handleSubmit(values: EventFormValues) {
    const raw = values.maxParticipants;
    const maxParticipants =
      raw !== undefined && raw !== null && String(raw) !== ""
        ? Number(raw)
        : undefined;

    const rawRate = values.minAssignmentRate;
    const minAssignmentRate =
      rawRate !== undefined && rawRate !== null && String(rawRate) !== ""
        ? Number(rawRate)
        : undefined;

    const submitData: EventFormSubmitData = {
      title: values.title,
      description: values.description || undefined,
      location: values.location || undefined,
      category: values.category!,
      type: values.type,
      maxParticipants,
      minAssignmentRate,
    };

    if (values.type === "SINGLE" && values.session) {
      submitData.session = {
        sessionNo: 1,
        sessionDate: values.session.sessionDate,
        startTime: values.session.startTime || undefined,
        endTime: values.session.endTime || undefined,
        topic: values.session.topic || undefined,
      };
    } else if (values.type === "SERIES" && values.sessions) {
      submitData.sessions = values.sessions.map((s, idx) => ({
        sessionNo: idx + 1,
        sessionDate: s.sessionDate,
        startTime: s.startTime || undefined,
        endTime: s.endTime || undefined,
        topic: s.topic || undefined,
      }));
    }

    await onSubmit(submitData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活動名稱 *</FormLabel>
                <FormControl>
                  <Input placeholder="請輸入活動名稱" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活動說明</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="請輸入活動說明"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>地點</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="請輸入活動地點（可多行，一行一個地點）"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活動類別 *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇活動類別" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(eventCategoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>類型</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選擇活動類型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(eventTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}活動</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          <FormField
            control={form.control}
            name="maxParticipants"
            render={({ field }) => (
              <FormItem>
                <FormLabel>人數上限</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="不限制人數"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val === "" ? undefined : Number(val));
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minAssignmentRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>作業完成率門檻 (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="例：80（表示需完成 80% 作業才能結業）"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Session Info */}
        {eventType === "SINGLE" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">場次資訊</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="session.sessionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>日期 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="session.topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>主題</FormLabel>
                    <FormControl>
                      <Input placeholder="場次主題" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="session.startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時間</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="session.endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束時間</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {eventType === "SERIES" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">場次列表</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    sessionDate: "",
                    startTime: "",
                    endTime: "",
                    topic: "",
                  })
                }
              >
                <Plus className="size-4" />
                新增場次
              </Button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-md border p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    第 {index + 1} 場
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`sessions.${index}.sessionDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>日期 *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sessions.${index}.topic`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>主題</FormLabel>
                        <FormControl>
                          <Input placeholder="場次主題" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sessions.${index}.startTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始時間</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`sessions.${index}.endTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>結束時間</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "處理中..."
              : mode === "create"
                ? "建立活動"
                : "儲存變更"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
