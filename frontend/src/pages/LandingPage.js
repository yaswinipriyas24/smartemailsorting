import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-shell">
      <div className="landing-noise" />

      <header className="landing-nav">
        <div className="landing-brand">Smart Email Sorting</div>
        <div className="landing-nav-actions">
          <button className="landing-btn ghost" onClick={() => navigate("/login")}>Login</button>
          <button className="landing-btn solid" onClick={() => navigate("/login?mode=register")}>Start Free</button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-kicker">AI-Powered Inbox Intelligence</p>
          <h1>Prioritize what matters. Resolve faster. Stay in control.</h1>
          <p className="landing-sub">
            Smart Email Sorting classifies your inbox, detects urgent deadlines, and gives teams
            a clear action dashboard with user and admin workflows.
          </p>

          <div className="landing-cta-row">
            <button className="landing-btn solid lg" onClick={() => navigate("/login?mode=register")}>Get Started</button>
            <button
              className="landing-btn ghost lg"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Product
            </button>
          </div>
        </section>

        <section id="features" className="landing-grid">
          <article className="landing-card">
            <h3>Classification Engine</h3>
            <p>
              Automatically categorizes emails into business-ready buckets like invoices,
              meetings, customer support, and legal.
            </p>
          </article>

          <article className="landing-card">
            <h3>Urgency Detection</h3>
            <p>
              Flags critical emails using urgency signals so teams can respond before deadlines
              are missed.
            </p>
          </article>

          <article className="landing-card">
            <h3>User Dashboard</h3>
            <p>
              Search, filter, resolve, and visualize inbox activity with clean analytics and
              actionable status insights.
            </p>
          </article>

          <article className="landing-card">
            <h3>Admin Control Center</h3>
            <p>
              Monitor model accuracy, apply manual overrides, retrain periodically, and manage
              users with role-based access.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
