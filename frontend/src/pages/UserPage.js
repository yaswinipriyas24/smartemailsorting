import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

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

function UserPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [emails, setEmails] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("http://localhost:8000/emails?limit=150", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        const data = res.data?.data || [];
        setEmails(data);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError("Failed to load emails.");
      })
      .finally(() => setLoading(false));
  }, [navigate, token]);

  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      if (a.urgent !== b.urgent) {
        return Number(b.urgent) - Number(a.urgent);
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }, [emails]);

  const urgentCount = useMemo(
    () => emails.filter((e) => e.urgent).length,
    [emails]
  );

  const readCount = useMemo(
    () => emails.filter((e) => e.is_read).length,
    [emails]
  );

  const unreadCount = useMemo(
    () => emails.filter((e) => !e.is_read).length,
    [emails]
  );

  const filteredEmails = useMemo(() => {
    if (selectedCategory === "All") return sortedEmails;
    if (selectedCategory === "Urgent") return sortedEmails.filter((e) => e.urgent);
    if (selectedCategory === "Unread") return sortedEmails.filter((e) => !e.is_read);
    if (selectedCategory === "Read") return sortedEmails.filter((e) => e.is_read);
    return sortedEmails.filter((e) => e.category === selectedCategory);
  }, [selectedCategory, sortedEmails]);

  const categories = ["All", "Urgent", "Unread", "Read", ...ALL_CATEGORIES];

  const openEmail = (email) => {
    setSelectedEmail({
      ...email,
      sender: email.sender || "Unknown sender",
      body: email.body || "Email body preview is not available in this view."
    });

    if (!email.is_read) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
      );
    }
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    alert("Reply API is not available yet.");
    setReplyText("");
  };

  return (
    <div className="dashboard user-dashboard">
      <div className="user-header">
        <h1 className="title">Smart Email Intelligence Dashboard</h1>
        <p className="user-subtitle">Track categories, open messages, and draft quick replies.</p>
      </div>

      {error && <p className="error user-error">{error}</p>}

      {urgentCount > 0 && (
        <div className="insight-banner">
          You have <strong>{urgentCount}</strong> urgent emails.
        </div>
      )}

      <div className="category-overview">
        <div className="category-card" onClick={() => setSelectedCategory("Unread")}>
          <h4>Unread</h4>
          <p>{unreadCount}</p>
        </div>

        <div className="category-card" onClick={() => setSelectedCategory("Read")}>
          <h4>Read</h4>
          <p>{readCount}</p>
        </div>
      </div>

      <div className="filter-container">
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${selectedCategory === category ? "active" : ""}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="email-section">
        <h2 className="section-title">{selectedCategory} Emails</h2>

        <table className="email-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Category</th>
              <th>Confidence</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="empty">
                  Loading...
                </td>
              </tr>
            ) : filteredEmails.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty">
                  No emails found
                </td>
              </tr>
            ) : (
              filteredEmails.map((email) => (
                <tr
                  key={email.id}
                  className="user-email-row"
                  onClick={() => openEmail(email)}
                >
                  <td
                    className="subject"
                    style={{ fontWeight: email.is_read ? "500" : "700" }}
                  >
                    {email.subject}
                  </td>

                  <td>
                    <span className="badge category">{email.category}</span>
                  </td>

                  <td>
                    {email.confidence
                      ? `${(email.confidence * 100).toFixed(1)}%`
                      : "0%"}
                  </td>

                  <td>
                    {email.urgent ? (
                      <span className="badge urgent">Urgent</span>
                    ) : (
                      <span className="badge normal">Normal</span>
                    )}
                  </td>

                  <td>
                    {email.is_read ? (
                      <span className="badge normal">Read</span>
                    ) : (
                      <span className="badge unread">Unread</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedEmail && (
        <div className="email-modal">
          <div className="email-modal-content">
            <h3>{selectedEmail.subject}</h3>
            <p>
              <strong>From:</strong> {selectedEmail.sender}
            </p>
            <hr />
            <div className="email-body">{selectedEmail.body}</div>

            <textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="reply-textarea"
            />

            <div className="modal-actions">
              <button className="reply-btn" onClick={handleReply}>Send Reply</button>

              <button className="close-btn" onClick={() => setSelectedEmail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserPage;
