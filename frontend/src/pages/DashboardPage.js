import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaClipboardList,
  FaCreditCard,
  FaSearch,
  FaEnvelope,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLink,
  FaSyncAlt,
  FaInbox,
  FaChartPie,
  FaChartLine,
  FaGavel,
  FaHeadset,
  FaLaptopCode,
  FaShoppingCart,
  FaTools,
  FaUsers,
} from "react-icons/fa";
import "../styles/dashboard.css";
import {
  getStoredPreferences,
  setReminderWindowHours,
  syncPreferencesFromProfile
} from "../utils/userPreferences";
import { clearSession, getAuthToken } from "../utils/authSession";
import { apiUrl } from "../utils/api";

const ALL_CATEGORIES = [
  "Announcements",
  "Customer Support",
  "Deadlines",
  "General Communication",
  "Human Resources",
  "Invoices",
  "Legal",
  "Marketing",
  "Meetings",
  "Orders",
  "Payments",
  "Performance Reports",
  "Project Updates",
  "Recruitment",
  "Reminders",
  "Technical Issues",
  "Training"
];

const CATEGORY_ICONS = {
  Announcements: FaBullhorn,
  "Customer Support": FaHeadset,
  Deadlines: FaCalendarAlt,
  "General Communication": FaUsers,
  "Human Resources": FaUsers,
  Invoices: FaClipboardList,
  Legal: FaGavel,
  Marketing: FaChartLine,
  Meetings: FaCalendarAlt,
  Orders: FaShoppingCart,
  Payments: FaCreditCard,
  "Performance Reports": FaChartLine,
  "Project Updates": FaTools,
  Recruitment: FaUsers,
  Reminders: FaCalendarAlt,
  "Technical Issues": FaLaptopCode,
  Training: FaClipboardList,
  All: FaInbox
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fullSyncing, setFullSyncing] = useState(false);
  const [syncTaskId, setSyncTaskId] = useState("");
  const [syncTaskState, setSyncTaskState] = useState("");
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [user, setUser] = useState({ email: "", role: "user", gmail_connected: false });
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [error, setError] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [deadlineAlerts, setDeadlineAlerts] = useState({
    count: 0,
    overdue_count: 0,
    due_soon_count: 0,
    data: []
  });
  const [notificationEnabled, setNotificationEnabled] = useState(
    getStoredPreferences().notificationEnabled
  );
  const [urgentAlertEnabled, setUrgentAlertEnabled] = useState(
    getStoredPreferences().urgentAlertEnabled
  );
  const [reminderWindowHours, setReminderWindow] = useState(
    getStoredPreferences().reminderWindowHours || 24
  );

  const toDisplayBody = useCallback((rawBody) => {
    if (!rawBody) return "No body content available.";
    const body = String(rawBody);
    const looksLikeHtml = /<\s*(html|head|body|table|div|span|p|a|img|style|meta|!doctype)/i.test(body);
    if (!looksLikeHtml) return body;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(body, "text/html");
      const text = doc?.body?.textContent || "";
      const compact = text
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return compact || "No readable text extracted from HTML email body.";
    } catch {
      return body;
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearSession();
    setError("Session expired. Please login again.");
    navigate("/login");
  }, [navigate]);

  const handleLogout = useCallback(() => {
    clearSession();
    navigate("/login");
  }, [navigate]);

  const handleTestNotification = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("This browser does not support notifications.");
      return;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      setError("Notification permission denied. Enable browser notifications to test.");
      return;
    }

    new Notification("Sample Deadline Reminder", {
      body: "Demo: A deadline is approaching. Please review and resolve urgent emails."
    });
    setError("");
  }, []);

  const startGoogleOAuth = useCallback(async () => {
    const freshToken = getAuthToken();
    if (!freshToken) {
      navigate("/login");
      return;
    }

    try {
      setOauthConnecting(true);
      setError("");
      const response = await axios.get(apiUrl("/gmail/connect"), {
        headers: { Authorization: `Bearer ${freshToken}` }
      });
      const authUrl = response?.data?.auth_url;
      if (!authUrl) throw new Error("OAuth URL missing");
      window.location.assign(authUrl);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to start Gmail OAuth.";
      setError(String(detail));
      // Fallback path if direct OAuth URL bootstrap fails
      navigate("/connect-gmail");
    } finally {
      setOauthConnecting(false);
    }
  }, [navigate, handleUnauthorized]);

  const fetchDeadlineAlerts = useCallback(async (activeToken, hours) => {
    const deadlineRes = await axios.get(
      apiUrl(`/notifications/deadlines?lookahead_hours=${hours}`),
      { headers: { Authorization: `Bearer ${activeToken}` } }
    );
    setDeadlineAlerts({
      count: Number(deadlineRes?.data?.count || 0),
      overdue_count: Number(deadlineRes?.data?.overdue_count || 0),
      due_soon_count: Number(deadlineRes?.data?.due_soon_count || 0),
      data: Array.isArray(deadlineRes?.data?.data) ? deadlineRes.data.data : []
    });
  }, []);

  const fetchMyFeedback = useCallback(async (activeToken) => {
    const feedbackRes = await axios.get(apiUrl("/feedback/my"), {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    setMyFeedbacks(Array.isArray(feedbackRes?.data?.data) ? feedbackRes.data.data : []);
  }, []);

  const loadDashboard = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const meRes = await axios.get(apiUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(meRes.data || {});
      syncPreferencesFromProfile(meRes?.data);
      setNotificationEnabled(meRes?.data?.notification_enabled !== false);
      setUrgentAlertEnabled(meRes?.data?.urgent_alert_enabled !== false);
      const reminderHours = Number(
        meRes?.data?.reminder_window_hours || getStoredPreferences().reminderWindowHours || 24
      );
      setReminderWindow(reminderHours);
      setReminderWindowHours(reminderHours);
      if (meRes?.data?.default_category_view) {
        setFilter((prev) =>
          prev === meRes.data.default_category_view ? prev : meRes.data.default_category_view
        );
      }

      if (meRes?.data?.role === "admin") {
        navigate("/admin");
        return;
      }

      if (!meRes?.data?.gmail_connected) {
        navigate("/connect-gmail");
        return;
      }

      try {
        const [emailsRes] = await Promise.all([
          axios.get(apiUrl("/emails?limit=150"), {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setEmails(Array.isArray(emailsRes?.data?.data) ? emailsRes.data.data : []);
        await fetchDeadlineAlerts(token, reminderHours);
        await fetchMyFeedback(token);
      } catch (emailErr) {
        console.error("Emails load failed:", emailErr);
        setEmails([]);
        setMyFeedbacks([]);
        setDeadlineAlerts({ count: 0, overdue_count: 0, due_soon_count: 0, data: [] });
        setError("Connected, but failed to load emails.");
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      console.error("Dashboard load failed:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load dashboard.";
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  }, [navigate, handleUnauthorized, fetchDeadlineAlerts, fetchMyFeedback]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get("gmail_error");
    if (!oauthError) return;

    const map = {
      denied: "Google OAuth was denied. Please allow access to continue.",
      missing_params: "OAuth callback failed (missing parameters).",
      token_failed: "OAuth token exchange failed. Check Google OAuth client settings.",
      no_refresh_token: "OAuth did not return a refresh token. Reconnect Gmail and allow offline access.",
      sync_failed: "Gmail connected, but initial sync failed. Try Sync Emails again."
    };
    setError(map[oauthError] || `OAuth error: ${oauthError}`);
  }, [location.search]);

  useEffect(() => {
    if (!notificationEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [notificationEnabled]);

  useEffect(() => {
    if (!notificationEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const reminderKey = `deadline-notify-${todayKey}`;
    if (localStorage.getItem(reminderKey)) return;

    if (deadlineAlerts.overdue_count > 0) {
      new Notification("Deadline Alert", {
        body: `${deadlineAlerts.overdue_count} deadline(s) are over. Resolve now.`
      });
      localStorage.setItem(reminderKey, "1");
      return;
    }

    if (deadlineAlerts.due_soon_count > 0) {
      new Notification("Upcoming Deadline", {
        body: `${deadlineAlerts.due_soon_count} email(s) have deadline within ${reminderWindowHours} hours.`
      });
      localStorage.setItem(reminderKey, "1");
    }
  }, [deadlineAlerts.overdue_count, deadlineAlerts.due_soon_count, notificationEnabled, reminderWindowHours]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !notificationEnabled) return undefined;
    const interval = window.setInterval(() => {
      fetchDeadlineAlerts(token, reminderWindowHours).catch(() => {});
    }, 180000);
    return () => window.clearInterval(interval);
  }, [notificationEnabled, reminderWindowHours, fetchDeadlineAlerts]);

  const handleSync = async () => {
    if (syncing || fullSyncing) return;
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setSyncing(true);
      setSyncTaskId("");
      setSyncTaskState("");
      setError("");

      // Always re-check on click to avoid stale frontend state.
      const meRes = await axios.get(apiUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const connected = !!meRes?.data?.gmail_connected;
      setUser((prev) => ({ ...prev, ...meRes.data }));

      if (!connected) {
        setError("Gmail is not connected. Redirecting to OAuth...");
        await startGoogleOAuth();
        return;
      }

      const queueRes = await axios.post(
        apiUrl("/sync-emails/async?limit=20&clear_db=false"),
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );

      const taskId = queueRes?.data?.task_id;
      if (!taskId) {
        setError("Sync was queued, but task id is missing.");
        return;
      }
      setSyncTaskId(taskId);
      setSyncTaskState("PENDING");

      const pollStart = Date.now();
      const maxWaitMs = 10 * 60 * 1000;
      while (Date.now() - pollStart < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusRes = await axios.get(
          apiUrl(`/sync-emails/tasks/${taskId}`),
          { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
        );

        const state = statusRes?.data?.state || "UNKNOWN";
        setSyncTaskState(state);

        if (state === "SUCCESS") {
          const taskResult = statusRes?.data?.result;
          if (taskResult?.status === "error") {
            const msg = String(taskResult?.message || "Sync failed.");
            const normalized = msg.toLowerCase();
            if (
              normalized.includes("oauth") ||
              normalized.includes("refresh token") ||
              normalized.includes("gmail oauth not connected") ||
              normalized.includes("connect gmail")
            ) {
              setUser((prev) => ({ ...prev, gmail_connected: false }));
              await startGoogleOAuth();
              return;
            }
            setError(msg);
            return;
          }
          await loadDashboard();
          return;
        }

        if (state === "FAILURE") {
          const msg = String(statusRes?.data?.error || "Sync task failed.");
          setError(msg);
          return;
        }
      }

      setError("Sync is still running. Please check again in a moment.");
      return;
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Sync failed";
      const normalized = String(msg).toLowerCase();
      if (
        normalized.includes("gmail oauth not connected") ||
        normalized.includes("refresh token") ||
        normalized.includes("invalid_grant") ||
        normalized.includes("connect gmail")
      ) {
        setUser((prev) => ({ ...prev, gmail_connected: false }));
        await startGoogleOAuth();
        return;
      }
      setError(String(msg));
    } finally {
      setSyncing(false);
    }
  };

  const handleFullSync = async () => {
    if (syncing || fullSyncing) return;
    const token = getAuthToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const ok = window.confirm(
      "This will clear stored emails and re-sync from Gmail to refresh status. Continue?"
    );
    if (!ok) return;

    try {
      setFullSyncing(true);
      setSyncTaskId("");
      setSyncTaskState("");
      setError("");

      const meRes = await axios.get(apiUrl("/auth/me"), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const connected = !!meRes?.data?.gmail_connected;
      setUser((prev) => ({ ...prev, ...meRes.data }));

      if (!connected) {
        setError("Gmail is not connected. Redirecting to OAuth...");
        await startGoogleOAuth();
        return;
      }

      const queueRes = await axios.post(
        apiUrl("/sync-emails/async?limit=200&clear_db=true"),
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );

      const taskId = queueRes?.data?.task_id;
      if (!taskId) {
        setError("Full sync was queued, but task id is missing.");
        return;
      }
      setSyncTaskId(taskId);
      setSyncTaskState("PENDING");

      const pollStart = Date.now();
      const maxWaitMs = 12 * 60 * 1000;
      while (Date.now() - pollStart < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const statusRes = await axios.get(
          apiUrl(`/sync-emails/tasks/${taskId}`),
          { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
        );
        const state = statusRes?.data?.state || "UNKNOWN";
        setSyncTaskState(state);

        if (state === "SUCCESS") {
          const taskResult = statusRes?.data?.result;
          if (taskResult?.status === "error") {
            const msg = String(taskResult?.message || "Full sync failed.");
            const normalized = msg.toLowerCase();
            if (
              normalized.includes("invalid_grant") ||
              normalized.includes("refresh token") ||
              normalized.includes("token has been expired or revoked") ||
              normalized.includes("gmail oauth not connected") ||
              normalized.includes("connect gmail")
            ) {
              setUser((prev) => ({ ...prev, gmail_connected: false }));
              setError("Gmail authorization expired. Redirecting to reconnect...");
              await startGoogleOAuth();
              return;
            }
            setError(msg);
            return;
          }
          await loadDashboard();
          return;
        }

        if (state === "FAILURE") {
          setError(String(statusRes?.data?.error || "Full sync task failed."));
          return;
        }
      }

      setError("Full sync is still running. Please check again in a moment.");
      return;
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Full sync failed";
      const normalized = String(msg).toLowerCase();
      if (
        normalized.includes("invalid_grant") ||
        normalized.includes("refresh token") ||
        normalized.includes("token has been expired or revoked") ||
        normalized.includes("gmail oauth not connected") ||
        normalized.includes("connect gmail")
      ) {
        setUser((prev) => ({ ...prev, gmail_connected: false }));
        setError("Gmail authorization expired. Redirecting to reconnect...");
        await startGoogleOAuth();
        return;
      }
      setError(String(msg));
    } finally {
      setFullSyncing(false);
    }
  };

  const handleResolve = async (emailId) => {
    const token = getAuthToken();
    if (!token) {
      handleUnauthorized();
      return;
    }
    try {
      await axios.patch(
        apiUrl(`/emails/${emailId}/resolve`),
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: true, is_resolved: true } : e))
      );
      setSelectedEmail((prev) =>
        prev && prev.id === emailId ? { ...prev, is_read: true, is_resolved: true } : prev
      );
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setError("Failed to mark email as resolved.");
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    if (!feedbackText.trim()) return;

    try {
      setFeedbackSubmitting(true);
      setFeedbackSuccess("");
      setFeedbackError("");
      await axios.post(
        apiUrl("/feedback"),
        { message: feedbackText.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeedbackText("");
      setFeedbackSuccess("Your feedback has been sent to the admin.");
      await fetchMyFeedback(token);
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setFeedbackError(err?.response?.data?.detail || "Failed to send feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const categories = useMemo(() => ["All", ...ALL_CATEGORIES], []);

  const filteredEmails = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      const byCategory = filter === "All" || email.category === filter;
      const bySearch =
        !search ||
        String(email.subject || "").toLowerCase().includes(search) ||
        String(email.sender || "").toLowerCase().includes(search) ||
        String(email.body || "").toLowerCase().includes(search);
      return byCategory && bySearch;
    });
  }, [emails, filter, searchQuery]);

  const stats = useMemo(() => {
    const total = emails.length;
    const urgent = emails.filter((e) => e.urgent).length;
    const resolved = emails.filter((e) => e.is_read || e.is_resolved).length;
    return { total, urgent, resolved };
  }, [emails]);

  const analytics = useMemo(() => {
    const byCategory = {};
    for (const email of emails) {
      const key = email.category || "Uncategorized";
      byCategory[key] = (byCategory[key] || 0) + 1;
    }
    const categoryRows = Object.entries(byCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const topCategories = categoryRows.slice(0, 6);
    const maxCategoryCount = topCategories[0]?.count || 1;

    const today = new Date();
    const dayBuckets = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - idx));
      d.setHours(0, 0, 0, 0);
      return { date: d, label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    const bucketMap = new Map(dayBuckets.map((d) => [d.date.getTime(), d]));

    for (const email of emails) {
      const raw = email.received_at || email.created_at;
      if (!raw) continue;
      const dt = new Date(raw);
      dt.setHours(0, 0, 0, 0);
      const bucket = bucketMap.get(dt.getTime());
      if (bucket) bucket.count += 1;
    }

    const maxDaily = Math.max(...dayBuckets.map((d) => d.count), 1);
    const chartWidth = 420;
    const chartHeight = 120;
    const points = dayBuckets.map((d, i) => {
      const x = (i / (dayBuckets.length - 1 || 1)) * chartWidth;
      const y = chartHeight - (d.count / maxDaily) * chartHeight;
      return `${x},${y}`;
    }).join(" ");

    const urgentPercent = stats.total ? Math.round((stats.urgent / stats.total) * 100) : 0;

    return {
      topCategories,
      maxCategoryCount,
      dayBuckets,
      dailyPoints: points,
      chartWidth,
      chartHeight,
      urgentPercent,
    };
  }, [emails, stats.total, stats.urgent]);

  const canShowNotifications = notificationEnabled;
  const canShowUrgentAlerts = notificationEnabled && urgentAlertEnabled;
  const hasActiveSearch = searchQuery.trim().length > 0;

  if (loading) {
    return <div className="dashboard">Loading Dashboard...</div>;
  }

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div className="page-header-row">
          <h1 className="title header-title">
            <FaInbox />
            Email Intelligence Dashboard
          </h1>
          <div className="header-actions">
            <button className="reply-btn" onClick={handleTestNotification}>Test Notification</button>
            <button className="close-btn" onClick={() => navigate("/profile")}>Profile</button>
            <button className="close-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <p className="user-subtitle">Monitor, prioritize, and resolve your inbox with confidence.</p>
        <div className="status-row">
          <span
            className={user.gmail_connected ? "connected" : "not-connected"}
          >
            <FaLink style={{ marginRight: "6px" }} />
            {user.gmail_connected ? "Gmail Connected" : "Gmail Not Connected"}
          </span>
          <button
            className="reply-btn"
            onClick={startGoogleOAuth}
            disabled={oauthConnecting}
          >
            {oauthConnecting
              ? "Connecting..."
              : user.gmail_connected
                ? "Reconnect Gmail"
                : "Connect Gmail"}
          </button>
        </div>
      </div>

      {error && canShowNotifications && <div className="user-error" style={{ padding: "10px", marginBottom: "16px" }}>{error}</div>}

      {!user.gmail_connected && canShowNotifications && (
        <div className="insight-banner">
          Gmail OAuth not connected.
        </div>
      )}

      {canShowUrgentAlerts && stats.urgent > 0 && (
        <div className="insight-banner" style={{ marginBottom: "16px" }}>
          You have {stats.urgent} urgent emails that need attention.
        </div>
      )}

      {canShowNotifications && deadlineAlerts.overdue_count > 0 && (
        <div className="insight-banner danger" style={{ marginBottom: "12px" }}>
          {deadlineAlerts.overdue_count} deadline{deadlineAlerts.overdue_count > 1 ? "s are" : " is"} over.
          Please resolve immediately.
        </div>
      )}

      {canShowNotifications && deadlineAlerts.due_soon_count > 0 && (
        <div className="insight-banner" style={{ marginBottom: "16px" }}>
          {deadlineAlerts.due_soon_count} email{deadlineAlerts.due_soon_count > 1 ? "s have" : " has"} deadline within {reminderWindowHours} hours.
        </div>
      )}

      <div className="card-container">
        <div className="card">
          <div>
            <h3><FaEnvelope style={{ marginRight: "6px" }} />Total Emails</h3>
            <p>{stats.total}</p>
          </div>
        </div>
        <div className="card">
          <div>
            <h3><FaExclamationTriangle style={{ marginRight: "6px" }} />Urgent</h3>
            <p>{stats.urgent}</p>
          </div>
        </div>
        <div className="card">
          <div>
            <h3><FaCheckCircle style={{ marginRight: "6px" }} />Resolved</h3>
            <p>{stats.resolved}</p>
          </div>
        </div>
      </div>

      <div className="viz-grid">
        <div className="upcoming-section viz-card">
          <h3 className="viz-title"><FaChartPie /> Category Distribution</h3>
          {analytics.topCategories.length ? (
            <div className="viz-bars">
              {analytics.topCategories.map((row) => (
                <div key={row.name} className="viz-bar-row">
                  <div className="viz-bar-meta">
                    <span>{row.name}</span>
                    <span>{row.count}</span>
                  </div>
                  <div className="viz-bar-track">
                    <div
                      className="viz-bar-fill"
                      style={{ width: `${(row.count / analytics.maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="viz-empty">No category data yet.</p>
          )}
        </div>

        <div className="upcoming-section viz-card">
          <h3 className="viz-title"><FaChartPie /> Urgency Split</h3>
          <div className="urgency-ring-wrap">
            <div
              className="urgency-ring"
              style={{
                background: `conic-gradient(var(--dash-urgent) ${analytics.urgentPercent}%, var(--dash-normal) ${analytics.urgentPercent}% 100%)`
              }}
            >
              <div className="urgency-ring-center">
                <strong>{analytics.urgentPercent}%</strong>
                <span>Urgent</span>
              </div>
            </div>
            <div className="urgency-legend">
              <div><span className="legend-dot urgent-dot" />Urgent: {stats.urgent}</div>
              <div><span className="legend-dot normal-dot" />Normal: {Math.max(stats.total - stats.urgent, 0)}</div>
            </div>
          </div>
        </div>

        <div className="upcoming-section viz-card viz-wide">
          <h3 className="viz-title"><FaChartLine /> 7-Day Email Volume</h3>
          {analytics.dayBuckets.some((d) => d.count > 0) ? (
            <>
              <div className="trend-svg-wrap">
                <svg viewBox={`0 0 ${analytics.chartWidth} ${analytics.chartHeight}`} className="trend-svg" preserveAspectRatio="none">
                  <polyline className="trend-line" points={analytics.dailyPoints} />
                </svg>
              </div>
              <div className="trend-labels">
                {analytics.dayBuckets.map((d) => (
                  <div key={d.label} className="trend-label">
                    <span>{d.label}</span>
                    <strong>{d.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="viz-empty">No trend data in the last 7 days.</p>
          )}
        </div>
      </div>

      <div className="category-overview category-overview-top">
        <div className="filter-container">
          {categories.map((cat) => {
            const IconComp = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                className={`filter-btn ${filter === cat ? "active" : ""}`}
                onClick={() => setFilter(cat)}
              >
                <span style={{ marginRight: "6px" }}>{IconComp ? <IconComp /> : <FaInbox />}</span>
                {cat}
              </button>
            );
          })}
        </div>

        <div className="toolbar-actions">
          <div className="search-wrap">
            <FaSearch
              className="search-icon"
            />
            <input
              type="text"
              placeholder="Search subject, sender, category, or body keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="reply-textarea"
              style={{ minHeight: "40px", width: "100%", marginTop: 0, paddingLeft: "34px" }}
            />
          </div>
          <button className="reply-btn" onClick={handleSync} disabled={syncing}>
            <FaSyncAlt style={{ marginRight: "6px" }} />
            {syncing ? "Syncing..." : "Sync Emails"}
          </button>
          <button className="close-btn" onClick={handleFullSync} disabled={syncing || fullSyncing}>
            {fullSyncing ? "Refreshing..." : "Full Sync (Refresh Status)"}
          </button>
        </div>
      </div>

      {(syncTaskId || syncTaskState) && (
        <div className="insight-banner" style={{ marginBottom: "14px" }}>
          Sync Task: <strong>{syncTaskState || "QUEUED"}</strong>
          {syncTaskId ? ` (id: ${syncTaskId.slice(0, 8)}...)` : ""}
        </div>
      )}

      <div className="email-section">
        <h2 className="section-title section-title-row">
          <FaInbox />
          Inbox
        </h2>
        {filteredEmails.length === 0 ? (
          <div className="upcoming-section empty-state-panel">
            <h3>{hasActiveSearch ? "No matching emails" : "Inbox is empty"}</h3>
            <p>
              {hasActiveSearch
                ? "Try different keywords or remove filters."
                : "Sync your mailbox to fetch and classify the latest emails."}
            </p>
            {!hasActiveSearch && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="reply-btn" onClick={handleSync} disabled={syncing || fullSyncing}>
                  {syncing ? "Syncing..." : "Sync Emails"}
                </button>
                <button className="close-btn" onClick={handleFullSync} disabled={syncing || fullSyncing}>
                  {fullSyncing ? "Refreshing..." : "Full Sync (Refresh Status)"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="email-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Category</th>
                  <th>Deadline</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmails.map((email) => (
                  <tr key={email.id} className="user-email-row" onClick={() => setSelectedEmail(email)}>
                    <td>{email.subject || "(No Subject)"}</td>
                    <td>{email.sender || "Unknown sender"}</td>
                    <td><span className="badge category">{email.category || "General"}</span></td>
                    <td>
                      {email.deadline_date
                        ? new Date(email.deadline_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {email.urgent ? (
                        <span className="badge urgent">Urgent</span>
                      ) : (
                        <span className="badge normal">Normal</span>
                      )}
                    </td>
                    <td>
                      {email.is_read || email.is_resolved ? (
                        <span className="badge normal">Resolved</span>
                      ) : (
                        <span className="badge urgent">Open</span>
                      )}
                    </td>
                    <td>
                      {email.is_read || email.is_resolved ? (
                        <span className="empty">-</span>
                      ) : (
                        <button
                          className="close-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(email.id);
                          }}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEmail && (
        <div className="email-modal" onClick={() => setSelectedEmail(null)}>
          <div className="email-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedEmail.subject || "(No Subject)"}</h3>
            <p><strong>From:</strong> {selectedEmail.sender || "Unknown sender"}</p>
            <p><strong>To:</strong> {selectedEmail.to_email || user.email}</p>
            <p><strong>Category:</strong> {selectedEmail.category || "General"}</p>
            <hr />
            <div className="email-body">{toDisplayBody(selectedEmail.body)}</div>
            <div className="modal-actions">
              <button
                className="reply-btn"
                onClick={() => handleResolve(selectedEmail.id)}
                disabled={selectedEmail.is_read || selectedEmail.is_resolved}
              >
                {selectedEmail.is_read || selectedEmail.is_resolved ? "Resolved" : "Mark as Resolved"}
              </button>
              <button className="close-btn" onClick={() => setSelectedEmail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="email-section" style={{ marginTop: "24px" }}>
        <h2 className="section-title section-title-row">
          <FaEnvelope />
          Feedback To Admin
        </h2>
        <div className="upcoming-section">
          <p className="user-subtitle" style={{ marginTop: 0, marginBottom: "12px" }}>
            Send issues, suggestions, or correction requests to the admin. Replies will appear below.
          </p>
          <form onSubmit={handleFeedbackSubmit}>
            <textarea
              className="reply-textarea"
              placeholder="Write your feedback for the admin..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              maxLength={2000}
              style={{ width: "100%", marginTop: 0 }}
            />
            {feedbackSuccess && (
              <div className="insight-banner" style={{ marginTop: "12px", marginBottom: "12px" }}>
                {feedbackSuccess}
              </div>
            )}
            {feedbackError && (
              <div className="user-error" style={{ padding: "10px", marginTop: "12px", marginBottom: "12px" }}>
                {feedbackError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="submit"
                className="reply-btn"
                disabled={feedbackSubmitting || !feedbackText.trim()}
              >
                {feedbackSubmitting ? "Sending..." : "Send Feedback"}
              </button>
            </div>
          </form>

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ marginTop: 0 }}>My Feedback History</h3>
            {myFeedbacks.length === 0 ? (
              <p className="viz-empty">No feedback submitted yet.</p>
            ) : (
              myFeedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  style={{
                    border: "1px solid var(--dash-border-soft)",
                    borderRadius: "14px",
                    padding: "14px 16px",
                    marginBottom: "12px",
                    background: "var(--dash-card)",
                    boxShadow: "var(--dash-shadow)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <strong>{feedback.status === "resolved" ? "Resolved" : "Pending"}</strong>
                    <span style={{ color: "var(--dash-muted)", fontSize: "14px" }}>
                      {feedback.created_at ? new Date(feedback.created_at).toLocaleString() : ""}
                    </span>
                  </div>
                  <p style={{ marginTop: "10px", marginBottom: feedback.admin_reply ? "12px" : 0 }}>
                    {feedback.message}
                  </p>
                  {feedback.admin_reply && (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "var(--dash-card-soft)",
                        borderLeft: "4px solid var(--dash-accent-teal)"
                      }}
                    >
                      <strong>Admin Reply</strong>
                      <p style={{ marginBottom: 0 }}>{feedback.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


