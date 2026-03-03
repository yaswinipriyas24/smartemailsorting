import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

const API_BASE = "http://localhost:8000";

export default function ProfilePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
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
      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data || null);
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      setError(err?.response?.data?.detail || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [navigate, logout, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await axios.post(
        `${API_BASE}/auth/change-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="dashboard">Loading profile...</div>;

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 className="title" style={{ marginBottom: 0 }}>Profile</h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="close-btn"
              onClick={() => navigate(profile?.role === "admin" ? "/admin" : "/dashboard")}
            >
              Back
            </button>
            <button className="close-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      {error && <div className="user-error" style={{ padding: "10px", marginBottom: "14px" }}>{error}</div>}
      {success && <div className="insight-banner" style={{ marginBottom: "14px" }}>{success}</div>}

      <div className="upcoming-section">
        <h3 style={{ marginTop: 0 }}>Account Details</h3>
        <p><strong>Email:</strong> {profile?.email}</p>
        <p><strong>Role:</strong> {profile?.role}</p>
        <p><strong>Status:</strong> {profile?.is_active ? "Active" : "Inactive"}</p>
        <p><strong>Gmail Connected:</strong> {profile?.gmail_connected ? "Yes" : "No"}</p>
        <p><strong>Gmail Email:</strong> {profile?.gmail_email || "-"}</p>
        <p><strong>Created At:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleString() : "-"}</p>
      </div>

      <div className="upcoming-section" style={{ marginTop: "18px" }}>
        <h3 style={{ marginTop: 0 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: "grid", gap: "10px", maxWidth: "520px" }}>
          <input
            type="password"
            className="reply-textarea"
            style={{ minHeight: "42px", marginTop: 0 }}
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="reply-textarea"
            style={{ minHeight: "42px", marginTop: 0 }}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="reply-textarea"
            style={{ minHeight: "42px", marginTop: 0 }}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" className="reply-btn" disabled={saving}>
            {saving ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
