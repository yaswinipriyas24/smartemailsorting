import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Import Pages
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ConnectGmailPage from "./pages/ConnectGmailPage";
import UserPage from "./pages/UserPage";

// 🔒 Authentication Guard: Redirects to login if no token exists
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Route: Anyone can access the login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Route: Dashboard requires a valid token */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          
          {/* Protected Route: Connect Gmail Page */}
          <Route 
            path="/connect-gmail" 
            element={
              <PrivateRoute>
                <ConnectGmailPage />
              </PrivateRoute>
            } 
          />

          <Route
            path="/user"
            element={
              <PrivateRoute>
                <UserPage />
              </PrivateRoute>
            }
          />

          {/* Default Redirects: Send users to login if they hit an unknown path */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
