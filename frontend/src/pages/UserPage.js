import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "../styles/dashboard.css";

/* ------------------------------------
   🎯 All 17 Categories
------------------------------------ */
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
  const [emails, setEmails] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);

  /* ------------------------------------
     📥 Fetch Emails
  ------------------------------------ */
  useEffect(() => {
    axios
      .get("/emails?limit=150")
      .then((res) => {
        const data = res.data?.data || [];
        setEmails(data);
      })
      .catch((err) => console.error("Fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  /* ------------------------------------
     🧠 Smart Sorting
     1️⃣ Urgent first
     2️⃣ High confidence next
  ------------------------------------ */
  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      if (a.urgent !== b.urgent) {
        return b.urgent - a.urgent;
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }, [emails]);

  /* ------------------------------------
     📊 Counts
  ------------------------------------ */
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

  /* ------------------------------------
     🔎 Filtering Logic
  ------------------------------------ */
  const filteredEmails = useMemo(() => {
    if (selectedCategory === "All") return sortedEmails;

    if (selectedCategory === "Urgent")
      return sortedEmails.filter((e) => e.urgent);

    if (selectedCategory === "Unread")
      return sortedEmails.filter((e) => !e.is_read);

    if (selectedCategory === "Read")
      return sortedEmails.filter((e) => e.is_read);

    return sortedEmails.filter(
      (e) => e.category === selectedCategory
    );
  }, [selectedCategory, sortedEmails]);

  const categories = [
    "All",
    "Urgent",
    "Unread",
    "Read",
    ...ALL_CATEGORIES
  ];

  /* ------------------------------------
     📬 Open Email + Mark Read
  ------------------------------------ */
  const openEmail = async (email) => {
    setSelectedEmail(email);

    if (!email.is_read) {
      try {
        await axios.put(`/emails/${email.id}/mark-read`);
        setEmails((prev) =>
          prev.map((e) =>
            e.id === email.id ? { ...e, is_read: true } : e
          )
        );
      } catch (err) {
        console.error("Mark read error:", err);
      }
    }
  };

  /* ------------------------------------
     ✉ Send Reply (Future Hook)
  ------------------------------------ */
  const handleReply = async () => {
    if (!replyText.trim()) return;

    try {
      await axios.post(`/emails/${selectedEmail.id}/reply`, {
        content: replyText
      });
      alert("Reply Sent Successfully!");
      setReplyText("");
    } catch (err) {
      console.error("Reply error:", err);
    }
  };

  return (
    <div className="dashboard">
      <h1 className="title">
        📧 Smart Email Intelligence Dashboard
      </h1>

      {urgentCount > 0 && (
        <div className="insight-banner">
          ⚠️ You have <strong>{urgentCount}</strong> urgent emails.
        </div>
      )}

      {/* 📊 Status Cards */}
      <div className="category-overview">
        <div
          className="category-card"
          onClick={() => setSelectedCategory("Unread")}
        >
          <h4>📩 Unread</h4>
          <p>{unreadCount}</p>
        </div>

        <div
          className="category-card"
          onClick={() => setSelectedCategory("Read")}
        >
          <h4>📖 Read</h4>
          <p>{readCount}</p>
        </div>
      </div>

      {/* 🎛 Filters */}
      <div className="filter-container">
        {categories.map((category, index) => (
          <button
            key={index}
            className={`filter-btn ${
              selectedCategory === category ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 📋 Email Table */}
      <div className="email-section">
        <h2 className="section-title">
          {selectedCategory} Emails
        </h2>

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
                  style={{ cursor: "pointer" }}
                  onClick={() => openEmail(email)}
                >
                  <td
                    className="subject"
                    style={{
                      fontWeight: email.is_read
                        ? "normal"
                        : "600"
                    }}
                  >
                    {email.subject}
                  </td>

                  <td>
                    <span className="badge category">
                      {email.category}
                    </span>
                  </td>

                  <td>
                    {email.confidence
                      ? (email.confidence * 100).toFixed(1) + "%"
                      : "0%"}
                  </td>

                  {/* Priority */}
                  <td>
                    {email.urgent ? (
                      <span className="badge urgent">
                        Urgent
                      </span>
                    ) : (
                      <span className="badge normal">
                        Normal
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    {email.is_read ? (
                      <span className="badge normal">
                        Read
                      </span>
                    ) : (
                      <span className="badge unread">
                        Unread
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 📬 Email Modal */}
      {selectedEmail && (
        <div className="email-modal">
          <div className="email-modal-content">
            <h3>{selectedEmail.subject}</h3>
            <p><strong>From:</strong> {selectedEmail.sender}</p>
            <hr />
            <div className="email-body">
              {selectedEmail.body}
            </div>

            <textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{
                width: "100%",
                height: "100px",
                marginTop: "15px"
              }}
            />

            <div style={{ marginTop: "10px" }}>
              <button onClick={handleReply}>
                Send Reply
              </button>

              <button
                onClick={() => setSelectedEmail(null)}
                style={{ marginLeft: "10px" }}
              >
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
