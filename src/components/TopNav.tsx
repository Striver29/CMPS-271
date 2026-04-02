import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.ts";
import { gradePointsMap, calculateGPA } from "../gpaCalculator";
import type { Course } from "../types";

type Props = {
  appName: string;
  semesterLabel: string;
  semesterId: string;
  semesters: { id: string; label: string }[];
  lastUpdatedText: string;
  onSemesterChange: (id: string) => void;
  scheduledCourses: Course[];
};

export function TopNav({
  appName,
  semesterLabel,
  semesterId,
  semesters,
  lastUpdatedText,
  scheduledCourses,
  onSemesterChange,
}: Props) {
  const navigate = useNavigate();
  const [showGpa, setShowGpa] = useState(false);
  const [rows, setRows] = useState(
    scheduledCourses.length > 0
      ? scheduledCourses.map((c) => ({
          course: c.code,
          grade: "A+",
          credits: String(c.credits),
        }))
      : [
          { course: "", grade: "A+", credits: "" },
          { course: "", grade: "A+", credits: "" },
        ],
  );

  const gradePoints = gradePointsMap;

  const gpa = (() => {
    const mapped = rows
      .filter((r) => !isNaN(parseFloat(r.credits)) && parseFloat(r.credits) > 0)
      .map((r) => ({
        credits: parseFloat(r.credits),
        grade: r.grade,
        semester: "",
      }));
    if (mapped.length === 0) return null;
    try {
      return calculateGPA(mapped).toFixed(2);
    } catch {
      return null;
    }
  })();

  const gpaValue = gpa !== null ? parseFloat(gpa) : null;
  const gpaColor =
    gpaValue === null
      ? "#475569"
      : gpaValue >= 3.5
        ? "#22c55e"
        : gpaValue >= 2.5
          ? "#f59e0b"
          : "#ef4444";
  const gpaLabel =
    gpaValue === null
      ? "No data"
      : gpaValue >= 3.7
        ? "Dean's List"
        : gpaValue >= 3.5
          ? "Excellent"
          : gpaValue >= 3.0
            ? "Very Good"
            : gpaValue >= 2.5
              ? "Good Standing"
              : gpaValue >= 2.0
                ? "Satisfactory"
                : "Needs Improvement";
  const gpaPercent =
    gpaValue !== null ? Math.min((gpaValue / 4.3) * 100, 100) : 0;
  const totalCredits = rows.reduce((s, r) => {
    const c = parseFloat(r.credits);
    return s + (isNaN(c) ? 0 : c);
  }, 0);
  const activeCourses = rows.filter((r) => parseFloat(r.credits) > 0).length;

  const addRow = () =>
    setRows((p) => [...p, { course: "", grade: "A+", credits: "" }]);
  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, value: string) =>
    setRows((p) =>
      p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  const resetRows = () =>
    setRows([
      { course: "", grade: "A+", credits: "" },
      { course: "", grade: "A+", credits: "" },
    ]);

  return (
    <>
      <style>{`
        @keyframes gpaIn  { from{opacity:0;transform:scale(0.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes gpaBg  { from{opacity:0} to{opacity:1} }
        .gpa-overlay {
          position:fixed; inset:0; z-index:99999;
          background:rgba(0,0,0,0.78);
          backdrop-filter:blur(7px);
          display:flex; align-items:center; justify-content:center;
          padding:16px;
          animation:gpaBg 0.18s ease;
        }
        .gpa-modal {
          width:720px; max-width:100%;
          background:#0f0f1c;
          border:1px solid #1e1e35;
          border-radius:18px;
          overflow:hidden;
          display:flex; flex-direction:column;
          max-height:92vh;
          animation:gpaIn 0.26s cubic-bezier(0.34,1.3,0.64,1);
          box-shadow:0 40px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03);
        }
        .gpa-mhead {
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 20px;
          border-bottom:1px solid #1e1e35;
          background:#0b0b17;
          flex-shrink:0;
        }
        .gpa-mhead-left { display:flex; align-items:center; gap:10px; }
        .gpa-mhead-icon {
          width:32px; height:32px; border-radius:8px;
          background:linear-gradient(135deg,#A32638,#6e1425);
          display:flex; align-items:center; justify-content:center; font-size:15px;
        }
        .gpa-mhead-title { font-size:14px; font-weight:700; color:#f1f5f9; }
        .gpa-mhead-sub   { font-size:11px; color:#475569; margin-top:1px; }
        .gpa-mhead-close {
          width:28px; height:28px; border-radius:7px;
          background:rgba(255,255,255,0.05); border:1px solid #1e1e35;
          color:#475569; font-size:12px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.15s;
        }
        .gpa-mhead-close:hover { background:rgba(163,38,56,0.25); color:#fff; border-color:rgba(163,38,56,0.4); }
        .gpa-body {
          display:grid;
          grid-template-columns:1fr 220px;
          flex:1; overflow:hidden;
          min-height:0;
        }
        .gpa-left {
          padding:16px 18px;
          overflow-y:auto;
          border-right:1px solid #1e1e35;
        }
        .gpa-left::-webkit-scrollbar { width:3px; }
        .gpa-left::-webkit-scrollbar-thumb { background:#A32638; border-radius:4px; }
        .gpa-left-title {
          font-size:10px; font-weight:700; color:#334155;
          text-transform:uppercase; letter-spacing:0.8px;
          margin-bottom:10px;
        }
        .gpa-col-heads {
          display:grid;
          grid-template-columns:1fr 80px 62px 26px;
          gap:6px; margin-bottom:6px; padding:0 2px;
        }
        .gpa-col-head {
          font-size:10px; font-weight:700; color:#334155;
          text-transform:uppercase; letter-spacing:0.6px;
        }
        .gpa-col-head.c { text-align:center; }
        .gpa-rows { display:flex; flex-direction:column; gap:5px; }
        .gpa-row {
          display:grid;
          grid-template-columns:1fr 80px 62px 26px;
          gap:6px; align-items:center;
          background:#141424;
          border:1px solid #1a1a30;
          border-radius:9px;
          padding:7px 9px;
          transition:border-color 0.15s;
        }
        .gpa-row:focus-within { border-color:rgba(163,38,56,0.45); }
        .g-in {
          background:transparent; border:none;
          color:#e2e8f0; font-size:12px; outline:none;
          width:100%; font-family:inherit;
        }
        .g-in::placeholder { color:#2d3748; }
        .g-sel {
          background:#0f0f1c; border:1px solid #1e1e35;
          color:#e2e8f0; border-radius:6px;
          padding:4px 4px; font-size:12px;
          cursor:pointer; outline:none; width:100%;
          font-family:inherit; transition:border-color 0.15s;
        }
        .g-sel:focus { border-color:rgba(163,38,56,0.5); }
        .g-num {
          background:#0f0f1c; border:1px solid #1e1e35;
          color:#e2e8f0; border-radius:6px;
          padding:4px 5px; font-size:12px;
          outline:none; width:100%; font-family:inherit;
          transition:border-color 0.15s; text-align:center;
        }
        .g-num:focus { border-color:rgba(163,38,56,0.5); }
        .g-del {
          background:none; border:none; cursor:pointer; padding:0;
          color:#2d3748; font-size:13px;
          display:flex; align-items:center; justify-content:center;
          width:26px; height:28px; border-radius:5px;
          transition:all 0.15s; margin:0 auto;
        }
        .g-del:not(:disabled):hover { color:#ef4444; background:rgba(239,68,68,0.1); }
        .g-del:disabled { cursor:default; }
        .gpa-add {
          width:100%; margin-top:8px; padding:8px;
          background:transparent; border:1px dashed #1e1e35;
          color:#334155; border-radius:8px; cursor:pointer;
          font-size:12px; font-weight:600; font-family:inherit;
          transition:all 0.18s;
          display:flex; align-items:center; justify-content:center; gap:5px;
        }
        .gpa-add:hover { border-color:#A32638; color:#A32638; background:rgba(163,38,56,0.05); }
        .gpa-right {
          display:flex; flex-direction:column;
          padding:16px 16px;
          background:#0b0b17;
          gap:12px;
        }
        .gpa-right-title {
          font-size:10px; font-weight:700; color:#334155;
          text-transform:uppercase; letter-spacing:0.8px;
        }
        .gpa-card {
          border-radius:12px;
          background:#111120;
          border:1px solid #1e1e35;
          overflow:hidden;
          flex-shrink:0;
        }
        .gpa-card-top { padding:14px 14px 10px; }
        .gpa-card-label { font-size:10px; color:#475569; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; }
        .gpa-card-number {
          font-size:54px; font-weight:800; line-height:1;
          letter-spacing:-4px; margin-top:4px;
          font-variant-numeric:tabular-nums;
          transition:color 0.3s;
        }
        .gpa-card-scale { font-size:11px; color:#334155; margin-top:2px; }
        .gpa-card-bar { height:3px; background:rgba(255,255,255,0.05); }
        .gpa-card-bar-fill { height:100%; transition:width 0.4s ease, background 0.3s; }
        .gpa-card-badge {
          padding:8px 14px;
          display:flex; align-items:center; gap:6px;
        }
        .gpa-badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .gpa-badge-text { font-size:12px; font-weight:700; }
        .gpa-stat-grid { display:flex; flex-direction:column; gap:6px; flex:1; }
        .gpa-stat-row {
          background:#111120; border:1px solid #1e1e35;
          border-radius:9px; padding:9px 12px;
          display:flex; align-items:center; justify-content:space-between;
        }
        .gpa-stat-lbl { font-size:11px; color:#475569; font-weight:600; }
        .gpa-stat-val { font-size:16px; font-weight:700; color:#94a3b8; }
        .gpa-footer {
          display:flex; gap:10px; padding:12px 18px;
          border-top:1px solid #1e1e35;
          background:#0b0b17;
          flex-shrink:0;
        }
        .gpa-btn-reset {
          padding:9px 20px;
          background:#0f0f1c; color:#475569;
          border:1px solid #1e1e35; border-radius:9px;
          cursor:pointer; font-size:13px; font-weight:600;
          font-family:inherit; transition:all 0.15s;
        }
        .gpa-btn-reset:hover { border-color:#A32638; color:#e2e8f0; }
        .gpa-btn-done {
          flex:1; padding:9px;
          background:linear-gradient(135deg,#A32638,#6e1425);
          color:#fff; border:none; border-radius:9px;
          cursor:pointer; font-size:13px; font-weight:700;
          font-family:inherit; letter-spacing:0.3px;
          box-shadow:0 4px 14px rgba(163,38,56,0.4);
          transition:all 0.18s;
        }
        .gpa-btn-done:hover { box-shadow:0 6px 22px rgba(163,38,56,0.6); transform:translateY(-1px); }
        .gpa-btn-done:active { transform:translateY(0); }
      `}</style>

      <header className="topNav">
        <div className="topNav__brand">
          <div className="topNav__logo" aria-hidden="true">
            {appName.slice(0, 1)}
          </div>
          <span className="topNav__brandText">{appName}</span>
        </div>

        <nav className="topNav__links" aria-label="Primary">
          <a
            className="topNav__link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            Home
          </a>

          <a
            className="topNav__link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/reviews")}
          >
            Reviews
          </a>

          <a
            className="topNav__link"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/room-finder")}
          >
            Room Finder
          </a>

          <a
            className="topNav__link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setRows(
                scheduledCourses.length > 0
                  ? scheduledCourses.map((c) => ({
                      course: c.code,
                      grade: "A+",
                      credits: String(c.credits),
                    }))
                  : [
                      { course: "", grade: "A+", credits: "" },
                      { course: "", grade: "A+", credits: "" },
                    ],
              );
              setShowGpa(true);
            }}
          >
            GPA Calculator
          </a>
        </nav>

        <div className="topNav__status" title={lastUpdatedText}>
          <span className="topNav__statusText">
            {semesterLabel} — {lastUpdatedText}
          </span>
        </div>

        <div className="topNav__controls">
          <span className="topNav__controlLabel">Change semester:</span>
          <select
            className="topNav__select"
            value={semesterId}
            onChange={(e) => onSemesterChange(e.target.value)}
            aria-label="Change semester"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            className="topNav__logout"
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {showGpa && (
        <div className="gpa-overlay" onClick={() => setShowGpa(false)}>
          <div className="gpa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gpa-mhead">
              <div className="gpa-mhead-left">
                <div className="gpa-mhead-icon">🎓</div>
                <div>
                  <div className="gpa-mhead-title">GPA Calculator</div>
                  <div className="gpa-mhead-sub">
                    American University of Beirut
                  </div>
                </div>
              </div>

              <button
                className="gpa-mhead-close"
                onClick={() => setShowGpa(false)}
              >
                ✕
              </button>
            </div>

            <div className="gpa-body">
              <div className="gpa-left">
                <div className="gpa-left-title">Courses</div>
                <div className="gpa-col-heads">
                  <span className="gpa-col-head">Course</span>
                  <span className="gpa-col-head c">Grade</span>
                  <span className="gpa-col-head c">Credits</span>
                  <span></span>
                </div>

                <div className="gpa-rows">
                  {rows.map((row, i) => (
                    <div key={i} className="gpa-row">
                      <input
                        type="text"
                        className="g-in"
                        placeholder={`Course ${i + 1}`}
                        value={row.course}
                        onChange={(e) => updateRow(i, "course", e.target.value)}
                      />

                      <select
                        className="g-sel"
                        value={row.grade}
                        onChange={(e) => updateRow(i, "grade", e.target.value)}
                      >
                        {Object.keys(gradePoints).map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        className="g-num"
                        placeholder="Cr"
                        min="0"
                        max="6"
                        value={row.credits}
                        onChange={(e) => updateRow(i, "credits", e.target.value)}
                      />

                      <button
                        className="g-del"
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button className="gpa-add" onClick={addRow}>
                  <span style={{ fontSize: "15px" }}>+</span> Add Course
                </button>
              </div>

              <div className="gpa-right">
                <div className="gpa-right-title">Live Summary</div>

                <div className="gpa-card">
                  <div className="gpa-card-top">
                    <div className="gpa-card-label">Your GPA</div>
                    <div className="gpa-card-number" style={{ color: gpaColor }}>
                      {gpa ?? "—"}
                    </div>
                    <div className="gpa-card-scale">out of 4.30</div>
                  </div>

                  <div className="gpa-card-bar">
                    <div
                      className="gpa-card-bar-fill"
                      style={{ width: `${gpaPercent}%`, background: gpaColor }}
                    />
                  </div>

                  <div
                    className="gpa-card-badge"
                    style={{ background: `${gpaColor}12` }}
                  >
                    <div className="gpa-badge-dot" style={{ background: gpaColor }} />
                    <span className="gpa-badge-text" style={{ color: gpaColor }}>
                      {gpaLabel}
                    </span>
                  </div>
                </div>

                <div className="gpa-stat-grid">
                  <div className="gpa-stat-row">
                    <span className="gpa-stat-lbl">Courses</span>
                    <span className="gpa-stat-val">{activeCourses || "—"}</span>
                  </div>
                  <div className="gpa-stat-row">
                    <span className="gpa-stat-lbl">Total Credits</span>
                    <span className="gpa-stat-val">{totalCredits || "—"}</span>
                  </div>
                  <div className="gpa-stat-row">
                    <span className="gpa-stat-lbl">Scale</span>
                    <span className="gpa-stat-val">4.30</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="gpa-footer">
              <button className="gpa-btn-reset" onClick={resetRows}>
                Reset
              </button>
              <button className="gpa-btn-done" onClick={() => setShowGpa(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}