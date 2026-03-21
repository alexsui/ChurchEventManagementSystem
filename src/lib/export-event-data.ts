import { formatSessionColumnHeader } from "@/lib/formatters";
import { isSessionPast } from "@/lib/utils";
import type { ExportData } from "@/lib/excel-export";

interface EventSession {
  id: string;
  sessionNo: number;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  topic: string | null;
}

interface FormResponseWithField {
  fieldId: string;
  value: string;
  field: { id: string; label: string; sortOrder: number };
}

interface FormFieldMeta {
  id: string;
  label: string;
  sortOrder: number;
}

interface Registration {
  id: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; phone: string };
  formResponses?: FormResponseWithField[];
}

interface AttendanceSummaryRecord {
  userId: string;
  eventSessionId: string;
}

interface AssignmentRecord {
  id: string;
  eventSessionId: string;
  title: string;
  completions: { userId: string }[];
}

interface BudgetItem {
  id: string;
  category: string;
  customCategory: string | null;
  estimated: number;
  actual: number;
  note: string | null;
}

interface BudgetSummary {
  totalEstimated: number;
  totalActual: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  MEAL: "餐費",
  SNACK: "點心",
  VENUE: "場地",
  MATERIAL: "教材",
  EQUIPMENT: "設備",
  OTHER: "其他",
};

export async function fetchEventExportData(eventId: string): Promise<ExportData> {
  const [eventRes, regRes, attRes, assignRes, budgetRes, formFieldsRes] = await Promise.all([
    fetch(`/api/events/${eventId}`),
    fetch(`/api/registrations?eventId=${eventId}`),
    fetch(`/api/events/${eventId}/attendance-summary`),
    fetch(`/api/events/${eventId}/assignment-summary`),
    fetch(`/api/budget?eventId=${eventId}`),
    fetch(`/api/events/${eventId}/form-fields?admin=true`),
  ]);

  const eventData = await eventRes.json();
  const sessions: EventSession[] = eventData.eventSessions ?? [];
  const allRegistrations: Registration[] = regRes.ok ? await regRes.json() : [];
  const registeredRegs = allRegistrations.filter((r) => r.status === "REGISTERED");
  const attendanceRecords: AttendanceSummaryRecord[] = attRes.ok ? await attRes.json() : [];
  const assignmentRecords: AssignmentRecord[] = assignRes.ok ? await assignRes.json() : [];
  const budgetData = budgetRes.ok
    ? await budgetRes.json()
    : { items: [], summary: { totalEstimated: 0, totalActual: 0 } };
  const formFieldsMeta: FormFieldMeta[] = formFieldsRes.ok ? await formFieldsRes.json() : [];

  const sessionLabels = sessions.map((s) => formatSessionColumnHeader(s));

  // --- Registrations ---
  const registrations = {
    rows: allRegistrations.map((r) => {
      const formResponses: Record<string, string> = {};
      if (r.formResponses) {
        for (const resp of r.formResponses) {
          formResponses[resp.field.label] = resp.value;
        }
      }
      return {
        userName: r.user.name,
        phone: r.user.phone,
        status: r.status,
        createdAt: r.createdAt,
        formResponses: Object.keys(formResponses).length > 0 ? formResponses : undefined,
      };
    }),
    formFields:
      formFieldsMeta.length > 0
        ? formFieldsMeta.map((f) => ({ label: f.label, sortOrder: f.sortOrder }))
        : undefined,
  };

  // --- Attendance overview ---
  const attendanceSet = new Set(attendanceRecords.map((r) => `${r.userId}:${r.eventSessionId}`));
  const sessionsWithAttData = new Set(attendanceRecords.map((r) => r.eventSessionId));
  const isResolved = (s: EventSession) => isSessionPast(s) || sessionsWithAttData.has(s.id);
  const allResolved = sessions.every(isResolved);

  const attendance = {
    sessionLabels,
    rows: registeredRegs.map((reg) => {
      let attended = 0;
      let resolved = 0;
      const sessionMap: Record<string, boolean | null> = {};

      sessions.forEach((s, i) => {
        if (!isResolved(s)) {
          sessionMap[sessionLabels[i]] = null;
          return;
        }
        resolved++;
        const didAttend = attendanceSet.has(`${reg.user.id}:${s.id}`);
        if (didAttend) attended++;
        sessionMap[sessionLabels[i]] = didAttend;
      });

      return {
        userName: reg.user.name,
        sessions: sessionMap,
        rate: allResolved && resolved > 0 ? `${Math.round((attended / resolved) * 100)}%` : "N/A",
      };
    }),
  };

  // --- Assignment overview ---
  // Group assignments by sessionId
  const assignmentsBySession = new Map<string, AssignmentRecord[]>();
  for (const a of assignmentRecords) {
    const list = assignmentsBySession.get(a.eventSessionId) ?? [];
    list.push(a);
    assignmentsBySession.set(a.eventSessionId, list);
  }

  // Build completion lookup: Set of "userId:assignmentId"
  const completionSet = new Set<string>();
  for (const a of assignmentRecords) {
    for (const c of a.completions) {
      completionSet.add(`${c.userId}:${a.id}`);
    }
  }

  const sessionsWithAssignments = new Set(assignmentRecords.map((a) => a.eventSessionId));
  const isAssignResolved = (s: EventSession) =>
    isSessionPast(s) || sessionsWithAssignments.has(s.id);
  const allAssignResolved = sessions.every(isAssignResolved);

  const minRate = eventData.minAssignmentRate;
  const hasResult = minRate != null;

  const assignments = {
    sessionLabels,
    hasResult,
    rows: registeredRegs.map((reg) => {
      let totalAll = 0;
      let completedAll = 0;
      const sessionResults: Record<string, string> = {};

      sessions.forEach((s, i) => {
        if (!isAssignResolved(s)) {
          sessionResults[sessionLabels[i]] = "N/A";
          return;
        }

        const sessionAssigns = assignmentsBySession.get(s.id);
        if (!sessionAssigns || sessionAssigns.length === 0) {
          sessionResults[sessionLabels[i]] = "—";
          return;
        }

        const total = sessionAssigns.length;
        const completed = sessionAssigns.filter((a) =>
          completionSet.has(`${reg.user.id}:${a.id}`)
        ).length;

        totalAll += total;
        completedAll += completed;
        sessionResults[sessionLabels[i]] = `${completed}/${total}`;
      });

      const canShowRate = allAssignResolved;
      const rateValue = canShowRate && totalAll > 0 ? completedAll / totalAll : null;
      const rate = rateValue != null ? `${Math.round(rateValue * 100)}%` : "N/A";
      const result =
        hasResult && rateValue != null ? (rateValue >= minRate ? "通過" : "未通過") : undefined;

      return { userName: reg.user.name, sessions: sessionResults, rate, result };
    }),
  };

  // --- Budget ---
  const budgetItems: BudgetItem[] = budgetData.items ?? [];
  const budgetSummary: BudgetSummary = budgetData.summary ?? {
    totalEstimated: 0,
    totalActual: 0,
  };

  const budget = {
    rows: budgetItems.map((item) => ({
      category: item.customCategory
        ? `${CATEGORY_LABELS[item.category] ?? item.category} (${item.customCategory})`
        : (CATEGORY_LABELS[item.category] ?? item.category),
      note: item.note ?? "",
      estimated: item.estimated,
      actual: item.actual,
    })),
    summary: {
      totalEstimated: budgetSummary.totalEstimated,
      totalActual: budgetSummary.totalActual,
      difference: budgetSummary.totalEstimated - budgetSummary.totalActual,
      executionRate:
        budgetSummary.totalEstimated > 0
          ? (budgetSummary.totalActual / budgetSummary.totalEstimated) * 100
          : 0,
    },
  };

  return {
    eventTitle: eventData.title,
    registrations,
    attendance,
    assignments,
    budget,
  };
}
