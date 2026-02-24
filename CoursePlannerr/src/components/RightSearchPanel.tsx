import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course } from '../types';

const API = 'http://localhost:3001';

type Props = {
  allCourses: Course[];
  scheduled: Course[];
  favorites: Course[];
  onSelectCourse: (course: Course) => void;
  onToggleSchedule: (course: Course) => void;
  onToggleFavorite: (course: Course) => void;
  onHoverCourse: (course: Course | null) => void;
  averageDifficulty: number | null;
  totalCredits: number;
  activeSlot: number;
  onSlotChange: (slot: number) => void;
};

type ViewModal = { course: Course } | null;

interface CourseRating {
  id: string;
  rating: number;
  difficulty: number;
  review: string;
  created_at: string;
}

export function RightSearchPanel({
  allCourses, scheduled, favorites,
  onSelectCourse, onToggleSchedule, onToggleFavorite, onHoverCourse,
  averageDifficulty, totalCredits,
  activeSlot, onSlotChange,
}: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [viewModal, setViewModal] = useState<ViewModal>(null);
  const [modalRatings, setModalRatings] = useState<CourseRating[]>([]);
  const [modalAvg, setModalAvg] = useState<{ rating: string; difficulty: string; count: number } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!viewModal) return;
    setModalLoading(true);
    const [dept, num] = viewModal.course.code.split(' ');
    fetch(`${API}/api/ratings/course/${dept}/${num}`)
      .then(r => r.json())
      .then(data => {
        setModalRatings(data.ratings || []);
        setModalAvg(data.averages || null);
      })
      .finally(() => setModalLoading(false));
  }, [viewModal]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Course[];
    const tokens = q.split(/\s+/);
    return allCourses
      .filter((c) => {
        const hay = `${c.code} ${c.title} ${c.instructor} ${c.crn}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 30);
  }, [allCourses, query]);

  const scheduledIds = useMemo(() => new Set(scheduled.map((c) => c.id)), [scheduled]);
  const favoriteIds = useMemo(() => new Set(favorites.map((c) => c.id)), [favorites]);

  const CourseItem = ({ c, showFavActive }: { c: Course; showFavActive?: boolean }) => {
    const inSchedule = scheduledIds.has(c.id);
    const isFav = favoriteIds.has(c.id);
    return (
      <li
        className="resultItem"
        onMouseEnter={() => onHoverCourse(c)}
        onMouseLeave={() => onHoverCourse(null)}
        style={{ flexDirection: 'column', gap: 0, padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <button
            className={`resultAction ${inSchedule ? 'isOn' : ''}`}
            type="button"
            onClick={() => onToggleSchedule(c)}
            title={inSchedule ? 'Remove from schedule' : 'Add to schedule'}
          >
            {inSchedule ? '☑' : '☐'}
          </button>

          <button
            className="resultMain"
            type="button"
            onClick={() => onSelectCourse(c)}
            title="Open course details"
            style={{ flex: 1 }}
          >
            <div className="resultMain__line1">{c.crn} {c.code} — {c.section} <span className="muted">{c.instructor}</span></div>
            <div className="resultMain__line2 muted">{c.title}</div>
          </button>

          <button
            className={`resultFav ${(showFavActive || isFav) ? 'isOn' : ''}`}
            type="button"
            onClick={() => onToggleFavorite(c)}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >★</button>
        </div>

        {/* Review buttons row */}
        <div style={{ display: 'flex', gap: '4px', padding: '3px 8px 5px 34px' }}>
          <button
            type="button"
            onClick={() => setViewModal({ course: c })}
            style={{
              fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
              border: '1px solid #555', backgroundColor: 'transparent',
              color: '#aaa', cursor: 'pointer',
            }}
          >⭐ View Reviews</button>
          <button
            type="button"
            onClick={() => navigate(`/reviews?course=${encodeURIComponent(c.code)}`)}
            style={{
              fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
              border: '1px solid #555', backgroundColor: 'transparent',
              color: '#aaa', cursor: 'pointer',
            }}
          >✏️ Write Review</button>
        </div>
      </li>
    );
  };

  return (
    <aside className="rightPanel">
      <div className="rightPanel__top">
        <div className="schTabs" role="tablist" aria-label="Schedules">
          {[1, 2, 3].map(slot => (
            <button
              key={slot}
              className={`schTab ${activeSlot === slot ? 'isActive' : ''}`}
              type="button"
              onClick={() => onSlotChange(slot)}
            >
              Schedule {slot}
            </button>
          ))}
          <button className="schTab" type="button" title="Settings" disabled>⚙️</button>
        </div>

        <input
          className="searchBox"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search… (e.g. CMPS 271, arab 232, 27101)"
        />

        <div className="miniStats">
          <div className="miniStats__item">
            <div className="miniStats__label">Selected</div>
            <div className="miniStats__value">{scheduled.length}</div>
          </div>
          <div className="miniStats__item">
            <div className="miniStats__label">Avg difficulty</div>
            <div className="miniStats__value">{averageDifficulty == null ? '—' : averageDifficulty.toFixed(2)}</div>
          </div>
          <div className="miniStats__item">
            <div className="miniStats__label">Credits</div>
            <div className="miniStats__value">{totalCredits}</div>
          </div>
        </div>
      </div>

      <div className="rightPanel__scroll">
        <div className="resultsSection">
          <div className="sectionTitle">Results</div>
          {!query.trim() ? (
            <div className="emptyState">Start typing to search.</div>
          ) : results.length === 0 ? (
            <div className="emptyState">No matches.</div>
          ) : (
            <ul className="resultList">
              {results.map((c) => <CourseItem key={c.id} c={c} />)}
            </ul>
          )}
        </div>

        <hr className="divider" />

        <div className="resultsSection">
          <div className="sectionTitle">Selected Courses</div>
          {scheduled.length === 0 ? (
            <div className="emptyState">No courses selected yet.</div>
          ) : (
            <ul className="resultList">
              {scheduled.map((c) => <CourseItem key={c.id} c={c} />)}
            </ul>
          )}
        </div>
      </div>

      {/* View Reviews Modal */}
      {viewModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }}
          onClick={() => setViewModal(null)}
        >
          <div
            style={{
              backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: '10px',
              padding: '24px', minWidth: '340px', maxWidth: '480px', width: '90%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>⭐ Reviews</div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{viewModal.course.code} — {viewModal.course.title}</div>
              </div>
              <button type="button" onClick={() => setViewModal(null)} style={{
                background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer',
              }}>✕</button>
            </div>

            {/* Avg stats */}
            {modalAvg && modalAvg.count > 0 && (
              <div style={{
                display: 'flex', gap: '16px', marginBottom: '16px',
                padding: '12px', backgroundColor: '#12122a', borderRadius: '8px',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>{modalAvg.rating}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>Rating</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>{modalAvg.difficulty}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>Difficulty</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>{modalAvg.count}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>Reviews</div>
                </div>
              </div>
            )}

            {/* Reviews list */}
            {modalLoading ? (
              <div style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>Loading...</div>
            ) : modalRatings.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                No reviews yet.
                <div style={{ marginTop: '8px' }}>
                  <button type="button"
                    onClick={() => { setViewModal(null); navigate(`/reviews?course=${encodeURIComponent(viewModal.course.code)}`); }}
                    style={{ fontSize: '12px', color: '#A32638', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Be the first to review!
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {modalRatings.map(r => (
                  <div key={r.id} style={{ backgroundColor: '#12122a', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: r.review ? '8px' : 0 }}>
                      <span style={{ backgroundColor: r.rating >= 4 ? '#22c55e' : r.rating >= 3 ? '#f59e0b' : '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '13px', padding: '2px 8px', borderRadius: '4px' }}>
                        {r.rating}/5
                      </span>
                      {r.difficulty > 0 && <span style={{ fontSize: '12px', color: '#6b7280' }}>Difficulty: {r.difficulty}/5</span>}
                      <span style={{ fontSize: '11px', color: '#4b5563', marginLeft: 'auto' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.review && <p style={{ margin: 0, fontSize: '13px', color: '#d1d5db', lineHeight: 1.6 }}>{r.review}</p>}
                  </div>
                ))}
              </div>
            )}

            <button type="button"
              onClick={() => { setViewModal(null); navigate(`/reviews?course=${encodeURIComponent(viewModal.course.code)}`); }}
              style={{
                marginTop: '16px', width: '100%', padding: '9px',
                backgroundColor: '#A32638', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
              }}>
              ✏️ Write a Review
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}