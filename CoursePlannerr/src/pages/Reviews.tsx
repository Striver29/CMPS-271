import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.ts';

const API = 'http://localhost:3001';
type Tab = 'courses' | 'professors';

interface CourseRating {
  id: string;
  department: string;
  course_number: string;
  rating: number;
  difficulty: number;
  review: string;
  created_at: string;
}

interface ProfessorRating {
  id: string;
  professor_id: string;
  department: string;
  course_number: string;
  rating: number;
  review: string;
  created_at: string;
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <span style={{ display: 'inline-flex', gap: 6, cursor: 'pointer' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{ color: i < (hovered || value) ? '#3b82f6' : '#374151', fontSize: 28, transition: 'color 0.1s' }}
          onMouseEnter={() => setHovered(i + 1)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i + 1)}
        >★</span>
      ))}
    </span>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <span style={{ width: 76, textAlign: 'right', fontSize: 13, color: '#9ca3af' }}>{label}</span>
      <div style={{ flex: 1, background: '#1f2937', borderRadius: 4, height: 14, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ width: 20, fontSize: 13, color: '#6b7280', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

function getRatingLabel(r: number) {
  if (r >= 5) return 'Awesome';
  if (r >= 4) return 'Great';
  if (r >= 3) return 'Good';
  if (r >= 2) return 'OK';
  return 'Awful';
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? '#22c55e' : score >= 3 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'inline-block', background: color, color: '#fff', fontWeight: 800, fontSize: 15, padding: '4px 12px', borderRadius: 6, minWidth: 48, textAlign: 'center' }}>
      {score.toFixed(1)}
    </div>
  );
}

function getDistribution(ratings: { rating: number }[]) {
  const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
  return dist;
}

export default function Reviews() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('courses');

  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const [courseSearch, setCourseSearch] = useState('');
  const [courseResults, setCourseResults] = useState<{ department: string; course_number: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<{ department: string; course_number: string; title: string } | null>(null);
  const [courseRatings, setCourseRatings] = useState<CourseRating[]>([]);
  const [courseAvg, setCourseAvg] = useState<{ rating: string; difficulty: string; count: number } | null>(null);

  const [profSearch, setProfSearch] = useState('');
  const [profResults, setProfResults] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedProf, setSelectedProf] = useState<{ id: string; full_name: string } | null>(null);
  const [profRatings, setProfRatings] = useState<ProfessorRating[]>([]);
  const [profAvg, setProfAvg] = useState<{ rating: string; count: number } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formDifficulty, setFormDifficulty] = useState(0);
  const [formReview, setFormReview] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formCourseNum, setFormCourseNum] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (courseSearch.length < 2) { setCourseResults([]); return; }
    const parts = courseSearch.trim().toUpperCase().split(' ');
    const dept = parts[0];
    const num = parts[1] || '';
    fetch(`${API}/api/courses?term=202620&search=${encodeURIComponent(dept)}`)
      .then(r => r.json())
      .then(data => {
        const seen = new Set<string>();
        const unique: { department: string; course_number: string; title: string }[] = [];
        for (const c of data) {
          const key = `${c.department}-${c.course_number}`;
          if (!seen.has(key) && c.course_number && (!num || c.course_number.startsWith(num))) {
            seen.add(key);
            unique.push({ department: c.department, course_number: c.course_number, title: c.title });
          }
        }
        setCourseResults(unique.slice(0, 8));
      })
      .catch(() => setCourseResults([]));
  }, [courseSearch]);

  useEffect(() => {
    if (profSearch.length < 2) { setProfResults([]); return; }
    fetch(`${API}/api/professors?search=${encodeURIComponent(profSearch)}`)
      .then(r => r.json())
      .then(data => setProfResults(data.slice(0, 8)))
      .catch(() => setProfResults([]));
  }, [profSearch]);

  const loadCourseRatings = (dept: string, num: string) => {
    fetch(`${API}/api/ratings/course/${dept}/${num}`)
      .then(r => r.json())
      .then(data => { setCourseRatings(data.ratings || []); setCourseAvg(data.averages || null); });
  };

  const loadProfRatings = (profId: string) => {
    fetch(`${API}/api/ratings/professor/${profId}`)
      .then(r => r.json())
      .then(data => { setProfRatings(data.ratings || []); setProfAvg(data.averages || null); });
  };

  const handleSelectCourse = (c: { department: string; course_number: string; title: string }) => {
    setSelectedCourse(c); setCourseSearch(`${c.department} ${c.course_number}`);
    setCourseResults([]); setShowForm(false); setSubmitted(false); setSubmitError(null);
    loadCourseRatings(c.department, c.course_number);
  };

  const handleSelectProf = (p: { id: string; full_name: string }) => {
    setSelectedProf(p); setProfSearch(p.full_name);
    setProfResults([]); setShowForm(false); setSubmitted(false); setSubmitError(null);
    loadProfRatings(p.id);
  };

  const handleSubmitCourse = async () => {
    if (!selectedCourse || formRating === 0 || !userId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API}/api/ratings/course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          department: selectedCourse.department,
          course_number: selectedCourse.course_number,
          rating: formRating,
          difficulty: formDifficulty || null,
          review: formReview || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Handle unique constraint: user already rated this course
        if (res.status === 409 || err?.code === '23505') {
          setSubmitError("You've already rated this course.");
        } else {
          setSubmitError('Something went wrong. Please try again.');
        }
        return;
      }
      setSubmitted(true);
      setShowForm(false);
      setFormRating(0); setFormDifficulty(0); setFormReview('');
      loadCourseRatings(selectedCourse.department, selectedCourse.course_number);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProf = async () => {
    if (!selectedProf || formRating === 0 || !formDept || !formCourseNum || !userId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API}/api/ratings/professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          professor_id: selectedProf.id,
          department: formDept.toUpperCase(),
          course_number: formCourseNum,
          rating: formRating,
          review: formReview || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 || err?.code === '23505') {
          setSubmitError("You've already rated this professor for that course.");
        } else {
          setSubmitError('Something went wrong. Please try again.');
        }
        return;
      }
      setSubmitted(true);
      setShowForm(false);
      setFormRating(0); setFormReview(''); setFormDept(''); setFormCourseNum('');
      loadProfRatings(selectedProf.id);
    } finally {
      setSubmitting(false);
    }
  };

  const card: React.CSSProperties = { background: '#111827', borderRadius: 12, padding: 28, border: '1px solid #1f2937' };

  const renderScorePanel = (score: string | undefined, count: number, name: string, subtitle?: string, extras?: React.ReactNode) => (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, color: '#f9fafb' }}>{count ? score : '—'}</span>
        <span style={{ fontSize: 22, color: '#6b7280', marginBottom: 12 }}>/5</span>
      </div>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
        Overall Quality Based on <strong style={{ color: '#f9fafb' }}>{count} rating{count !== 1 ? 's' : ''}</strong>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#f9fafb', marginBottom: 4 }}>{name}</div>
      {subtitle && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{subtitle}</div>}
      {extras}
      <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!showForm && !submitted && (
          authLoading ? null : !userId ? (
            <span style={{ fontSize: 13, color: '#6b7280' }}>Sign in to leave a review</span>
          ) : (
            <button
              onClick={() => { setShowForm(true); setSubmitError(null); }}
              style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '11px 28px', borderRadius: 30, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >Rate →</button>
          )
        )}
        {submitted && <span style={{ color: '#34d399', fontSize: 14 }}>✅ Thanks for your review!</span>}
        {submitError && <span style={{ color: '#f87171', fontSize: 13 }}>{submitError}</span>}
      </div>
    </div>
  );

  const renderDistribution = (dist: Record<number, number>, total: number) => (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: '#f9fafb' }}>Rating Distribution</div>
      {[5, 4, 3, 2, 1].map(n => (
        <RatingBar key={n} label={`${getRatingLabel(n)} ${n}`} count={dist[n] ?? 0} total={total} />
      ))}
    </div>
  );

  const renderForm = (onSubmit: () => void, showDiff = false, showCourse = false) => (
    <div style={{ ...card, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18, color: '#f9fafb' }}>Your Review</div>
      {showCourse && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Course</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inputStyle} placeholder="CMPS" value={formDept} onChange={e => setFormDept(e.target.value)} />
            <input style={inputStyle} placeholder="201" value={formCourseNum} onChange={e => setFormCourseNum(e.target.value)} />
          </div>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Overall Rating</label>
        <StarInput value={formRating} onChange={setFormRating} />
      </div>
      {showDiff && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Difficulty</label>
          <StarInput value={formDifficulty} onChange={setFormDifficulty} />
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Review (optional)</label>
        <textarea style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} value={formReview} onChange={e => setFormReview(e.target.value)} placeholder="Share your experience..." rows={3} />
      </div>
      {submitError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{submitError}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onSubmit}
          disabled={formRating === 0 || submitting || (showCourse && (!formDept || !formCourseNum))}
          style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 30, cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: formRating === 0 || submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        <button onClick={() => { setShowForm(false); setSubmitError(null); }} style={{ background: 'none', border: '1px solid #374151', color: '#9ca3af', padding: '10px 24px', borderRadius: 30, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e5e7eb', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '14px 32px', borderBottom: '1px solid #1f2937', background: '#111827', gap: 20 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #374151', color: '#9ca3af', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>← Planner</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f9fafb' }}>Reviews</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['courses', 'professors'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setShowForm(false); setSubmitted(false); setSubmitError(null); }} style={{ background: tab === t ? '#1d4ed8' : 'none', border: '1px solid', borderColor: tab === t ? '#1d4ed8' : '#374151', color: tab === t ? '#fff' : '#9ca3af', padding: '7px 22px', borderRadius: 6, cursor: 'pointer', fontSize: 14, textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <input
            style={{ ...inputStyle, width: '100%', fontSize: 16, padding: '14px 18px', boxSizing: 'border-box' }}
            placeholder={tab === 'courses' ? 'Search course (e.g. CMPS 201)' : 'Search professor name'}
            value={tab === 'courses' ? courseSearch : profSearch}
            onChange={e => {
              if (tab === 'courses') { setCourseSearch(e.target.value); setSelectedCourse(null); setShowForm(false); }
              else { setProfSearch(e.target.value); setSelectedProf(null); setShowForm(false); }
            }}
          />
          {(tab === 'courses' ? courseResults : profResults).length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1f2937', border: '1px solid #374151', borderRadius: 10, zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
              {tab === 'courses'
                ? courseResults.map(c => (
                  <div key={`${c.department}-${c.course_number}`} onClick={() => handleSelectCourse(c)}
                    style={{ padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontWeight: 700, color: '#f9fafb', minWidth: 90 }}>{c.department} {c.course_number}</span>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>{c.title}</span>
                  </div>
                ))
                : profResults.map(p => (
                  <div key={p.id} onClick={() => handleSelectProf(p)}
                    style={{ padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid #374151' }}>
                    <span style={{ fontWeight: 600, color: '#f9fafb' }}>{p.full_name}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Course detail */}
        {tab === 'courses' && selectedCourse && (() => {
          const dist = getDistribution(courseRatings);
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {renderScorePanel(courseAvg?.rating, courseAvg?.count ?? 0, `${selectedCourse.department} ${selectedCourse.course_number}`, selectedCourse.title,
                  courseAvg?.count ? (
                    <div style={{ paddingTop: 16, borderTop: '1px solid #1f2937' }}>
                      <span style={{ fontSize: 24, fontWeight: 800, color: '#f9fafb' }}>{courseAvg.difficulty}</span>
                      <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>Level of Difficulty</span>
                    </div>
                  ) : null
                )}
                {renderDistribution(dist, courseAvg?.count ?? 0)}
              </div>
              {showForm && renderForm(handleSubmitCourse, true)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {courseRatings.length === 0
                  ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 48, ...card }}>No reviews yet. Be the first!</div>
                  : courseRatings.map(r => (
                    <div key={r.id} style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: r.review ? 12 : 0 }}>
                        <ScoreBadge score={r.rating} />
                        {r.difficulty > 0 && <span style={{ fontSize: 13, color: '#6b7280' }}>Difficulty: {r.difficulty}/5</span>}
                        <span style={{ fontSize: 12, color: '#4b5563', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.review && <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.7 }}>{r.review}</p>}
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })()}

        {/* Professor detail */}
        {tab === 'professors' && selectedProf && (() => {
          const dist = getDistribution(profRatings);
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {renderScorePanel(profAvg?.rating, profAvg?.count ?? 0, selectedProf.full_name)}
                {renderDistribution(dist, profAvg?.count ?? 0)}
              </div>
              {showForm && renderForm(handleSubmitProf, false, true)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profRatings.length === 0
                  ? <div style={{ textAlign: 'center', color: '#6b7280', padding: 48, ...card }}>No reviews yet. Be the first!</div>
                  : profRatings.map(r => (
                    <div key={r.id} style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: r.review ? 12 : 0 }}>
                        <ScoreBadge score={r.rating} />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{r.department} {r.course_number}</span>
                        <span style={{ fontSize: 12, color: '#4b5563', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.review && <p style={{ margin: 0, fontSize: 14, color: '#d1d5db', lineHeight: 1.7 }}>{r.review}</p>}
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1f2937',
  border: '1px solid #374151',
  color: '#f9fafb',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
};