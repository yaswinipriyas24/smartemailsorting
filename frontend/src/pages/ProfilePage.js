import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { applyTheme, setReminderWindowHours, syncPreferencesFromProfile } from "../utils/userPreferences";
import { clearSession, getAuthToken } from "../utils/authSession";
import { apiUrl } from "../utils/api";
const DEFAULT_CATEGORIES = [
  "All",
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

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [busyReconnect, setBusyReconnect] = useState(false);
  const [busyLogoutAll, setBusyLogoutAll] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fullName, setFullName] = useState("");
  const [defaultCategoryView, setDefaultCategoryView] = useState("All");
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [urgentAlertEnabled, setUrgentAlertEnabled] = useState(true);
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [reminderWindowHours, setReminderHours] = useState(24);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const authTokenExp = useMemo(() => {
    const decoded = decodeJwt(token || "");
    if (!decoded?.exp) return null;
    return new Date(decoded.exp * 1000);
  }, [token]);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login");
  }, [navigate]);

  const loadProfile = useCallback(async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await axios.get(apiUrl("/auth/me"), { headers: authHeaders });
      const data = res.data || {};
      syncPreferencesFromProfile(data);
      setProfile(data);
      setFullName(data.full_name || "");
      setDefaultCategoryView(data.default_category_view || "All");
      setNotificationEnabled(data.notification_enabled !== false);
      setUrgentAlertEnabled(data.urgent_alert_enabled !== false);
      setTheme(data.theme || "light");
      setLanguage(data.language || "en");
      setReminderHours(Number(data.reminder_window_hours || 24));
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      setError(err?.response?.data?.detail || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, logout, navigate, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const savePreferences = async (e) => {
    e.preventDefault();
    try {
      setSavingPrefs(true);
      setError("");
      setSuccess("");
      await axios.patch(
        apiUrl("/profile"),
        {
          full_name: fullName,
          default_category_view: defaultCategoryView,
          notification_enabled: notificationEnabled,
          urgent_alert_enabled: urgentAlertEnabled,
          theme,
          language,
          reminder_window_hours: reminderWindowHours
        },
        { headers: authHeaders }
      );
      syncPreferencesFromProfile({
        theme,
        notification_enabled: notificationEnabled,
        urgent_alert_enabled: urgentAlertEnabled,
        default_category_view: defaultCategoryView,
        language,
        reminder_window_hours: reminderWindowHours
      });
      setReminderWindowHours(reminderWindowHours);
      setSuccess("Profile preferences updated.");
      await loadProfile();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setSavingPassword(true);
      setError("");
      setSuccess("");
      await axios.post(
        apiUrl("/auth/change-password"),
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        },
        { headers: authHeaders }
      );
      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleReconnectGmail = async () => {
    try {
      setBusyReconnect(true);
      setError("");
      const res = await axios.get(apiUrl("/gmail/connect"), { headers: authHeaders });
      const authUrl = res?.data?.auth_url;
      if (!authUrl) throw new Error("OAuth URL missing");
      window.location.assign(authUrl);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to start Gmail reconnection");
    } finally {
      setBusyReconnect(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      setBusyLogoutAll(true);
      setError("");
      setSuccess("");
      await axios.post(apiUrl("/auth/logout-all-devices"), {}, { headers: authHeaders });
      logout();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to logout all devices");
      setBusyLogoutAll(false);
    }
  };

  if (loading) return <div className="dashboard">Loading profile...</div>;

  const initial = (fullName || profile?.email || "U").trim().charAt(0).toUpperCase();
  const gmailTokenExpiry = profile?.token_expiry ? new Date(profile.token_expiry) : null;

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div className="page-header-row">
          <h1 className="title" style={{ marginBottom: 0 }}>Profile</h1>
          <div className="header-actions">
            <button className="close-btn" onClick={() => navigate(profile?.role === "admin" ? "/admin" : "/dashboard")}>Back</button>
            <button className="close-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      {error && <div className="user-error" style={{ padding: "10px", marginBottom: "14px" }}>{error}</div>}
      {success && <div className="insight-banner" style={{ marginBottom: "14px" }}>{success}</div>}

      <div className="upcoming-section profile-top">
        <div className="profile-avatar-wrap">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-fallback">{initial}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 6px 0" }}>{fullName || "Unnamed User"}</h2>
          <p className="user-subtitle" style={{ margin: "0 0 6px 0" }}>{profile?.email}</p>
          <span className={`badge ${profile?.role === "admin" ? "urgent" : "normal"}`}>{profile?.role || "user"}</span>
        </div>
      </div>

      <div className="card-container">
        <div className="card"><div><h3>Total Emails Processed</h3><p>{profile?.total_emails_processed ?? 0}</p></div></div>
        <div className="card"><div><h3>Total Urgent Emails</h3><p>{profile?.total_urgent_emails ?? 0}</p></div></div>
        <div className="card"><div><h3>Avg Response Time</h3><p>{profile?.avg_response_hours ?? "-"}h</p></div></div>
      </div>

      <div className="upcoming-section">
        <h3 style={{ marginTop: 0 }}>Account & Security</h3>
        <p><strong>Account Created:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleString() : "-"}</p>
        <p><strong>Last Login:</strong> {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString() : "-"}</p>
        <p><strong>Last Sync:</strong> {profile?.last_sync_at ? new Date(profile.last_sync_at).toLocaleString() : "-"}</p>
        <p><strong>Gmail Status:</strong> {profile?.gmail_connected ? "Connected" : "Not Connected"}</p>
        <p><strong>Two-Factor Auth:</strong> {profile?.two_factor_enabled ? "Enabled" : "Not Enabled"}</p>
        <p><strong>App Token Expiry:</strong> {authTokenExp ? authTokenExp.toLocaleString() : "-"}</p>
        <p><strong>Gmail Token Expiry:</strong> {gmailTokenExpiry ? gmailTokenExpiry.toLocaleString() : "-"}</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
          <button className="reply-btn" onClick={handleReconnectGmail} disabled={busyReconnect}>
            {busyReconnect ? "Connecting..." : "Reconnect Gmail"}
          </button>
          <button className="close-btn" onClick={handleLogoutAllDevices} disabled={busyLogoutAll}>
            {busyLogoutAll ? "Logging Out..." : "Logout All Devices"}
          </button>
        </div>
      </div>

      <div className="upcoming-section">
        <h3 style={{ marginTop: 0 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: "grid", gap: "10px", maxWidth: "520px" }}>
          <input type="password" className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <input type="password" className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <input type="password" className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <button type="submit" className="reply-btn" disabled={savingPassword}>{savingPassword ? "Saving..." : "Update Password"}</button>
        </form>
      </div>

      <div className="upcoming-section">
        <h3 style={{ marginTop: 0 }}>Preferences</h3>
        <form onSubmit={savePreferences} style={{ display: "grid", gap: "10px", maxWidth: "640px" }}>
          <input className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <select className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} value={defaultCategoryView} onChange={(e) => setDefaultCategoryView(e.target.value)}>
            {DEFAULT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <label><input type="checkbox" checked={notificationEnabled} onChange={(e) => setNotificationEnabled(e.target.checked)} /> Enable notifications</label>
          <label><input type="checkbox" checked={urgentAlertEnabled} onChange={(e) => setUrgentAlertEnabled(e.target.checked)} /> Enable urgent alerts</label>
          <select
            className="reply-textarea"
            style={{ minHeight: "42px", marginTop: 0 }}
            value={reminderWindowHours}
            onChange={(e) => setReminderHours(Number(e.target.value))}
          >
            <option value={6}>Reminder window: 6 hours</option>
            <option value={12}>Reminder window: 12 hours</option>
            <option value={24}>Reminder window: 24 hours</option>
            <option value={48}>Reminder window: 48 hours</option>
          </select>
          <label><input type="radio" name="theme" value="light" checked={theme === "light"} onChange={(e) => { setTheme(e.target.value); applyTheme(e.target.value); }} /> Light Theme</label>
          <label><input type="radio" name="theme" value="dark" checked={theme === "dark"} onChange={(e) => { setTheme(e.target.value); applyTheme(e.target.value); }} /> Dark Theme</label>
          <select className="reply-textarea" style={{ minHeight: "42px", marginTop: 0 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
          </select>
          <button type="submit" className="reply-btn" disabled={savingPrefs}>{savingPrefs ? "Saving..." : "Save Preferences"}</button>
        </form>
      </div>

      {profile?.role === "admin" && (
        <div className="upcoming-section">
          <h3 style={{ marginTop: 0 }}>Admin Access</h3>
          <p><strong>System Access Level:</strong> {profile?.system_access_level || "full"}</p>
          <p><strong>Total Users Managed:</strong> {profile?.total_users_managed ?? 0}</p>
          <p><strong>Model Version Running:</strong> {profile?.model_version_running || "-"}</p>
          <button className="reply-btn" onClick={() => navigate("/admin")}>Open Admin Dashboard</button>
        </div>
      )}
    </div>
  );
}
