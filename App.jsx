// App.jsx
import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";

import Dashboard from "./Dashboard.jsx";
import Courses from "./Courses.jsx";
import GPA from "./GPA";
import Rate from "./Rate";


export default function App() {
  const [courses, setCourses] = useState([
    { id: 1, name: "CS101", credits: 3, grade: "A", semester: "Fall2026" },
  ]);

  return (
    <Router>
      <div
        style={{
          fontFamily: "Arial, sans-serif",
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        {/* Navbar */}
        <nav
          style={{
            backgroundColor: "#A32638",
            padding: "15px",
            display: "flex",
            justifyContent: "center",
            gap: "25px",
            color: "#fff",
            fontWeight: "bold",
            borderRadius: "5px",
            flexWrap: "wrap",
          }}
        >
          <NavLink to="/" end>🏠 Dashboard</NavLink>
          <NavLink to="/courses">📚 Courses</NavLink>
          <NavLink to="/gpa">🎓 GPA Calculator</NavLink>
          <NavLink to="/rate" end>⭐ Rate</NavLink>
        </nav>

        <div style={{ padding: "20px" }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/courses"
              element={<Courses courses={courses} setCourses={setCourses} />}
            />
            {<Route path="/rate" element={<Rate />} /> }
            <Route path="/gpa" element={<GPA courses={courses} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
