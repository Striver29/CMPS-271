// pages/Dashboard.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div>
      <h2 style={{ color: "#A32638" }}>Student Dashboard</h2>
      <p>Welcome! Choose an action:</p>

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        {/* Courses Card */}
        <Link
          to="/courses"
          style={{ flex: "1 1 200px", textDecoration: "none" }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              color: "#A32638",
              padding: "30px",
              borderRadius: "10px",
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "pointer",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.15)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
          >
            <h3>📚 Courses</h3>
            <p>Add, edit, or remove your courses</p>
          </div>
        </Link>

        {/* GPA Card */}
        <Link to="/gpa" style={{ flex: "1 1 200px", textDecoration: "none" }}>
          <div
            style={{
              backgroundColor: "#fff",
              color: "#A32638",
              padding: "30px",
              borderRadius: "10px",
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "pointer",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.15)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
          >
            <h3>🎓 GPA Calculator</h3>
            <p>Calculate your GPA for any semester</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
