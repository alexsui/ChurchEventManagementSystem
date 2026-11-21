export const roleLabels: Record<string, string> = {
  ADMIN: "管理員",
  STAFF_ADMIN: "行政同工",
  STAFF_GENERAL: "總務同工",
  STAFF_FINANCE: "財務同工",
  PASTOR: "傳道人",
  STAFF_MEDIA: "多媒體同工",
  TEAM_LEADER: "組長",
  MEMBER: "一般會員",
};

export const allRoles = Object.keys(roleLabels);

// Event status labels — admin uses shorter labels, public uses friendlier labels
export const eventStatusLabels: Record<string, string> = {
  PLANNING: "企劃中",
  OPEN: "報名中",
  IN_PROGRESS: "進行中",
  COMPLETED: "已結束",
};

export const eventStatusPublicLabels: Record<string, string> = {
  PLANNING: "籌備中",
  OPEN: "開放報名",
  IN_PROGRESS: "進行中",
  COMPLETED: "已結束",
};

export const eventStatusFlow = ["PLANNING", "OPEN", "IN_PROGRESS", "COMPLETED"] as const;

export const eventCategoryLabels: Record<string, string> = {
  COURSE: "課程",
  LECTURE: "講座",
  CAMP: "營會",
};

export const eventTypeLabels: Record<string, string> = {
  SINGLE: "單場",
  SERIES: "系列",
};

export const registrationStatusLabels: Record<string, string> = {
  REGISTERED: "已報名",
  WAITLISTED: "候補中",
  CANCELLED: "已取消",
};

export const budgetCategoryLabels: Record<string, string> = {
  MEAL: "午晚餐",
  SNACK: "茶點",
  VENUE: "場佈",
  MATERIAL: "材料",
  EQUIPMENT: "設備",
  OTHER: "其他",
};

export const validBudgetCategories = Object.keys(budgetCategoryLabels);

export const moduleLabels: Record<string, string> = {
  events: "活動管理",
  registrations: "報名管理",
  attendance: "出席管理",
  assignments: "任務分配",
  teams: "小組管理",
  budget: "預算管理",
  reports: "報表",
};

export const providerLabels: Record<string, string> = {
  google: "Google",
  line: "LINE",
  credentials: "帳號密碼",
};

export const eventStatusClassNames: Record<string, string> = {
  PLANNING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  OPEN: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  COMPLETED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const registrationStatusClassNames: Record<string, string> = {
  REGISTERED: "bg-green-100 text-green-700",
  WAITLISTED: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export const formFieldTypeLabels: Record<string, string> = {
  TEXT: "文字",
  YES_NO: "是否",
  SINGLE_CHOICE: "單選",
};

// ==================== Punch (打卡) ====================

export const punchNavLabel = "打卡管理";

// Member punch page messages, keyed by API status / error code
export const punchStatusMessages: Record<string, string> = {
  NOT_LOGGED_IN: "請先登入以完成打卡",
  OUT_OF_RANGE: "今天不在打卡期間內",
  NOT_MEMBER: "你不在這個打卡名單中，如需加入請聯絡負責同工",
  PUNCHED: "今天已打卡",
  ALREADY_PUNCHED: "今天已打卡",
  NOT_FOUND: "找不到此打卡活動",
};

// Admin error messages, keyed by API error code
export const punchErrorMessages: Record<string, string> = {
  INVALID_INPUT: "資料有誤，請檢查名稱與日期",
  INVALID_DATE: "日期格式不正確",
  ALREADY_MEMBER: "此人已在名單中",
  USER_NOT_FOUND: "找不到此使用者",
  MEMBER_NOT_FOUND: "找不到此成員",
  NOT_FOUND: "找不到此打卡活動",
};
