import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.ts';

type Props = {
  appName: string;
  semesterLabel: string;
  semesterId: string;
  semesters: { id: string; label: string }[];
  lastUpdatedText: string;
  onSemesterChange: (id: string) => void;
};

export function TopNav({
  appName,
  semesterLabel,
  semesterId,
  semesters,
  lastUpdatedText,
  onSemesterChange,
}: Props) {
  const navigate = useNavigate();
  const [showGpa, setShowGpa] = useState(false);
  const [rows, setRows] = useState([
    { course: '', grade: 'A', credits: '' },
    { course: '', grade: 'A', credits: '' },
  ]);

  const gradePoints: Record<string, number> = {
    'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'F': 0.0,
  };

  const gpa = (() => {
    let totalPoints = 0, totalCredits = 0;
    for (const r of rows) {
      const cr = parseFloat(r.credits);
      if (!isNaN(cr) && cr > 0) {
        totalPoints += (gradePoints[r.grade] ?? 0) * cr;
        totalCredits += cr;
      }
    }
    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : null;
  })();

  const addRow = () => setRows(prev => [...prev, { course: '', grade: 'A', credits: '' }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, value: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  return (
    <>
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
              document.querySelector('.middlePanel')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Home
          </a>
          <a
            className="topNav__link"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/reviews')}
          >
            Reviews
          </a>
          <a
            className="topNav__link"
            href="#"
            onClick={(e) => { e.preventDefault(); setShowGpa(true); }}
          >
            GPA Calculator
          </a>
        </nav>
        <div className="topNav__status" title={lastUpdatedText}>
          <span className="topNav__statusText">{semesterLabel} — {lastUpdatedText}</span>
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
          <button className="topNav__logout" type="button" onClick={async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }}>Logout</button>
        </div>
      </header>

      {/* GPA Calculator Modal */}
      {showGpa && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
          }}
          onClick={() => setShowGpa(false)}
        >
          <div
            style={{
              backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: '12px',
              padding: '24px', width: '480px', maxWidth: '95vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>🎓 GPA Calculator</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>Enter your courses to calculate your GPA</div>
              </div>
              <button
                type="button"
                onClick={() => setShowGpa(false)}
                style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 32px', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
              {['Course (optional)', 'Grade', 'Credits', ''].map(h => (
                <span key={h} style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {rows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 32px', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={`Course ${i + 1}`}
                    value={row.course}
                    onChange={e => updateRow(i, 'course', e.target.value)}
                    style={{
                      backgroundColor: '#2a2a3e', border: '1px solid #444', color: '#fff',
                      borderRadius: '6px', padding: '6px 8px', fontSize: '13px',
                    }}
                  />
                  <select
                    value={row.grade}
                    onChange={e => updateRow(i, 'grade', e.target.value)}
                    style={{
                      backgroundColor: '#2a2a3e', border: '1px solid #444', color: '#fff',
                      borderRadius: '6px', padding: '6px 4px', fontSize: '13px',
                    }}
                  >
                    {Object.keys(gradePoints).map(g => <option key={g}>{g}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Cr"
                    min="0"
                    max="6"
                    value={row.credits}
                    onChange={e => updateRow(i, 'credits', e.target.value)}
                    style={{
                      backgroundColor: '#2a2a3e', border: '1px solid #444', color: '#fff',
                      borderRadius: '6px', padding: '6px 8px', fontSize: '13px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= 1}
                    style={{
                      background: 'none', border: 'none', color: rows.length <= 1 ? '#555' : '#ff6666',
                      fontSize: '16px', cursor: rows.length <= 1 ? 'default' : 'pointer', padding: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <button
              type="button"
              onClick={addRow}
              style={{
                marginTop: '10px', width: '100%', padding: '7px',
                backgroundColor: '#2a2a3e', border: '1px dashed #555',
                color: '#aaa', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              }}
            >+ Add Course</button>

            {/* GPA Result */}
            <div style={{
              marginTop: '16px', padding: '14px', borderRadius: '8px',
              backgroundColor: '#12122a', border: '1px solid #333',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: '#aaa', fontSize: '14px', fontWeight: 600 }}>Calculated GPA</span>
              <span style={{
                fontSize: '28px', fontWeight: 'bold',
                color: gpa === null ? '#555'
                  : parseFloat(gpa) >= 3.5 ? '#4caf50'
                  : parseFloat(gpa) >= 2.5 ? '#f0c040'
                  : '#ff6666',
              }}>
                {gpa ?? '—'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowGpa(false)}
              style={{
                marginTop: '12px', width: '100%', padding: '9px',
                backgroundColor: '#A32638', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
              }}
            >Done</button>
          </div>
        </div>
      )}
    </>
  );
}
