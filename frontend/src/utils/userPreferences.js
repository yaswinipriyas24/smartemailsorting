const THEME_KEY = "theme";
const NOTIFICATION_KEY = "notification_enabled";
const URGENT_ALERT_KEY = "urgent_alert_enabled";
const DEFAULT_CATEGORY_KEY = "default_category_view";
const LANGUAGE_KEY = "language";
const REMINDER_WINDOW_KEY = "reminder_window_hours";

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

function toBool(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return TRUE_VALUES.has(value.toLowerCase());
  if (value == null) return fallback;
  return Boolean(value);
}

export function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, resolved);
  document.documentElement.setAttribute("data-theme", resolved);
  document.body.setAttribute("data-theme", resolved);
}

export function getStoredPreferences() {
  const rawReminder = Number(localStorage.getItem(REMINDER_WINDOW_KEY) || 24);
  const reminderWindowHours = Number.isFinite(rawReminder) && rawReminder > 0 ? rawReminder : 24;
  return {
    theme: localStorage.getItem(THEME_KEY) || "light",
    notificationEnabled: toBool(localStorage.getItem(NOTIFICATION_KEY), true),
    urgentAlertEnabled: toBool(localStorage.getItem(URGENT_ALERT_KEY), true),
    defaultCategoryView: localStorage.getItem(DEFAULT_CATEGORY_KEY) || "All",
    language: localStorage.getItem(LANGUAGE_KEY) || "en",
    reminderWindowHours
  };
}

export function syncPreferencesFromProfile(profile) {
  if (!profile) return;
  if (profile.theme != null) applyTheme(profile.theme);
  if (profile.notification_enabled != null) {
    localStorage.setItem(NOTIFICATION_KEY, String(Boolean(profile.notification_enabled)));
  }
  if (profile.urgent_alert_enabled != null) {
    localStorage.setItem(URGENT_ALERT_KEY, String(Boolean(profile.urgent_alert_enabled)));
  }
  if (profile.default_category_view != null) {
    localStorage.setItem(DEFAULT_CATEGORY_KEY, profile.default_category_view || "All");
  }
  if (profile.language != null) {
    localStorage.setItem(LANGUAGE_KEY, profile.language || "en");
  }
  if (profile.reminder_window_hours != null) {
    const val = Number(profile.reminder_window_hours);
    if (Number.isFinite(val) && val > 0) {
      localStorage.setItem(REMINDER_WINDOW_KEY, String(Math.round(val)));
    }
  }
}

export function setReminderWindowHours(hours) {
  const val = Number(hours);
  if (!Number.isFinite(val) || val <= 0) return;
  localStorage.setItem(REMINDER_WINDOW_KEY, String(Math.round(val)));
}
