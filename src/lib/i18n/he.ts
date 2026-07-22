export const he = {
  appName: "ClockIn",
  common: { save: "שמירה", cancel: "ביטול", delete: "מחיקה", edit: "עריכה", loading: "טוען...", retry: "ניסיון נוסף", confirm: "אישור", back: "חזרה", close: "סגירה", estimated: "הערכה בלבד" },
  nav: { home: "בית", entries: "שעות", report: "דוח", settings: "הגדרות" },
  auth: { login: "כניסה לחשבון", register: "יצירת חשבון", email: "דואר אלקטרוני", password: "סיסמה", username: "שם משתמש", forgot: "שכחתי סיסמה", reset: "איפוס סיסמה", logout: "יציאה", noAccount: "עדיין אין לך חשבון?", haveAccount: "כבר יש לך חשבון?", checkEmail: "שלחנו אליך קישור להמשך", invalid: "הפרטים שהוזנו אינם תקינים", unavailable: "שם המשתמש כבר תפוס" },
  clock: { start: "התחלת עבודה", stop: "סיום עבודה", active: "השעון פעיל", inactive: "יום העבודה טרם התחיל", finished: "יום העבודה הסתיים", startedAt: "שעת כניסה", expected: "היעד להיום", balance: "מאזן יומי", failedStart: "לא ניתן להתחיל את השעון", failedStop: "לא ניתן לסיים את השעון", greeting: "שלום", todayWorked: "עבדת היום" },
  dashboard: { title: "היום שלך", week: "סיכום השבוע", recent: "דיווחים אחרונים", vacation: "יתרת חופשה", sick: "יתרת מחלה", reminder: "התזכורת הבאה", noEntries: "עדיין אין דיווחים להיום", outOf: "מתוך", noReminder: "לא הוגדרה תזכורת" },
  entries: { title: "דיווחי שעות", add: "הוספת דיווח", edit: "עריכת דיווח", empty: "לא נמצאו דיווחים", clockIn: "כניסה", clockOut: "יציאה", duration: "משך", note: "הערה", reason: "סיבת השינוי", manual: "דיווח ידני", active: "פעיל", history: "היסטוריית שינויים", overlap: "הדיווח חופף לדיווח קיים", invalidRange: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" },
  report: { title: "דוח חודשי", toDate: "עד היום", fullMonth: "חודש מלא", worked: "שעות בפועל", expected: "שעות צפויות", credited: "היעדרות מזוכה", adjustments: "התאמות", missing: "שעות חסרות", overtime: "שעות נוספות", completedDays: "ימי עבודה שהושלמו", vacationDays: "ימי חופשה", sickDays: "ימי מחלה", compensation: "שכר משוער", currentMonth: "החודש הנוכחי", exportCsv: "ייצוא לקובץ", print: "הדפסה", empty: "אין נתונים לחודש שנבחר" },
  settings: { title: "הגדרות", profile: "פרופיל", schedule: "שעות עבודה", compensation: "שכר", leave: "חופשה ומחלה", exceptions: "חגים וימים מיוחדים", reminders: "תזכורות", accessibility: "נגישות", install: "התקנת ClockIn", notifications: "התראות", testNotification: "שליחת התראת ניסיון", reduceMotion: "הפחתת תנועה", readability: "קריאות גבוהה" },
  onboarding: { title: "היכרות קצרה", profile: "פרופיל", schedule: "שגרת העבודה", compensation: "הגדרת שכר", leave: "חופשות ותזכורות", next: "המשך", previous: "הקודם", finish: "סיום והתחלה", resumable: "אפשר לחזור ולהמשיך בכל שלב" },
  status: { offline: "אין חיבור לאינטרנט", saved: "השינויים נשמרו", syncing: "ממתין לסנכרון", error: "לא ניתן לטעון את הנתונים", provisional: "זמני", vacation: "יום חופשה", sick: "יום מחלה", holiday: "יום חג", shortened: "יום מקוצר", missing: "חסרות שעות", overtime: "שעות נוספות" },
  validation: { required: "שדה חובה", email: "יש להזין כתובת דואר תקינה", password: "הסיסמה חייבת לכלול לפחות 8 תווים", username: "שם המשתמש חייב לכלול 3 עד 30 תווים", minutes: "יש להזין מספר דקות תקין" },
  days: ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"],
} as const;

export type HebrewCopy = typeof he;
