import * as XLSX from "xlsx";
import { formatPercent } from "@/lib/formatters";

interface RegistrationRow {
  userName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  formResponses?: Record<string, string>;
}

interface AttendanceOverviewRow {
  userName: string;
  sessions: Record<string, boolean | null>; // sessionLabel → attended
  rate: string;
}

interface AssignmentOverviewRow {
  userName: string;
  sessions: Record<string, string>; // sessionLabel → "X/Y"
  rate: string;
  result?: string;
}

interface BudgetRow {
  category: string;
  note: string;
  estimated: number;
  actual: number;
}

interface BudgetSummary {
  totalEstimated: number;
  totalActual: number;
  difference: number;
  executionRate: number;
}

export interface ExportData {
  eventTitle: string;
  registrations?: {
    rows: RegistrationRow[];
    formFields?: { label: string; sortOrder: number }[];
  };
  attendance?: {
    sessionLabels: string[];
    rows: AttendanceOverviewRow[];
  };
  assignments?: {
    sessionLabels: string[];
    rows: AssignmentOverviewRow[];
    hasResult: boolean;
  };
  budget?: {
    rows: BudgetRow[];
    summary: BudgetSummary;
  };
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "已報名",
  CANCELLED: "已取消",
  WAITLISTED: "候補中",
};

export function exportEventToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();

  if (data.registrations) {
    addRegistrationsSheet(wb, data.registrations.rows, data.registrations.formFields);
  }

  if (data.attendance) {
    addAttendanceSheet(wb, data.attendance.sessionLabels, data.attendance.rows);
  }

  if (data.assignments) {
    addAssignmentsSheet(
      wb,
      data.assignments.sessionLabels,
      data.assignments.rows,
      data.assignments.hasResult
    );
  }

  if (data.budget) {
    addBudgetSheet(wb, data.budget.rows, data.budget.summary);
  }

  const filename = `${data.eventTitle}_報表.xlsx`;
  XLSX.writeFile(wb, filename);
}

function addRegistrationsSheet(
  wb: XLSX.WorkBook,
  rows: RegistrationRow[],
  formFields?: { label: string; sortOrder: number }[]
) {
  const sortedFields = formFields ? [...formFields].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const fieldLabels = sortedFields.map((f) => f.label);

  const headers = ["姓名", "電話", "狀態", "報名時間", ...fieldLabels];
  const wsData = [
    headers,
    ...rows.map((r) => [
      r.userName,
      r.phone ?? "",
      STATUS_LABELS[r.status] ?? r.status,
      new Date(r.createdAt).toLocaleString("zh-TW"),
      ...fieldLabels.map((label) => r.formResponses?.[label] ?? ""),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "報名");
}

function addAttendanceSheet(
  wb: XLSX.WorkBook,
  sessionLabels: string[],
  rows: AttendanceOverviewRow[]
) {
  const headers = ["姓名", ...sessionLabels, "出席率"];
  const wsData = [
    headers,
    ...rows.map((r) => [
      r.userName,
      ...sessionLabels.map((label) => {
        const val = r.sessions[label];
        if (val === null) return "N/A";
        return val ? "✓" : "✗";
      }),
      r.rate,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "出席");
}

function addAssignmentsSheet(
  wb: XLSX.WorkBook,
  sessionLabels: string[],
  rows: AssignmentOverviewRow[],
  hasResult: boolean
) {
  const headers = ["姓名", ...sessionLabels, "完成率", ...(hasResult ? ["結果"] : [])];
  const wsData = [
    headers,
    ...rows.map((r) => [
      r.userName,
      ...sessionLabels.map((label) => r.sessions[label] ?? "—"),
      r.rate,
      ...(hasResult ? [r.result ?? ""] : []),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "作業");
}

function addBudgetSheet(wb: XLSX.WorkBook, rows: BudgetRow[], summary: BudgetSummary) {
  const headers = ["類別", "備註", "預估金額", "實際金額"];
  const wsData = [
    headers,
    ...rows.map((r) => [r.category, r.note, r.estimated, r.actual]),
    [], // empty row
    ["預估總計", "", summary.totalEstimated, ""],
    ["實際總計", "", "", summary.totalActual],
    ["差額", "", summary.difference, ""],
    ["執行率", "", `${summary.executionRate.toFixed(1)}%`, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "預算");
}

export interface PunchExportData {
  title: string;
  dates: string[];
  members: {
    name: string | null;
    phone: string | null;
    joinedOn: string;
    leftOn: string | null;
    attendedDates: string[];
    attended: number;
    eligible: number;
    rate: number | null;
  }[];
}

/** 打卡出席率: one row per member, plus one column per rehearsal date. */
export function exportPunchStatsToExcel(data: PunchExportData) {
  const headers = [
    "姓名",
    "電話",
    "加入日期",
    "退出日期",
    "出席次數",
    "應出席次數",
    "出席率",
    ...data.dates,
  ];
  const wsData = [
    headers,
    ...data.members.map((m) => {
      const attended = new Set(m.attendedDates);
      return [
        m.name ?? "",
        m.phone ?? "",
        m.joinedOn,
        m.leftOn ?? "",
        m.attended,
        m.eligible,
        formatPercent(m.rate),
        // Blank when the date is outside this member's roster window
        ...data.dates.map((date) => {
          if (date < m.joinedOn || (m.leftOn !== null && date > m.leftOn)) return "";
          return attended.has(date) ? "✓" : "✗";
        }),
      ];
    }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "出席率");
  XLSX.writeFile(wb, `${data.title}_出席率.xlsx`);
}
