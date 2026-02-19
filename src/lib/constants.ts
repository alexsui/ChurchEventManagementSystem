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
