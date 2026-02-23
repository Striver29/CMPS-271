import { useMemo, useState } from 'react';
import type { Course } from '../types';

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
};

type ReviewModal = { course: Course; mode: 'write' | 'view' } | null;

export function RightSearchPanel({
  allCourses, scheduled, favorites,
  onSelectCourse, onToggleSchedule, onToggleFavorite, onHoverCourse,
  averageDifficulty, totalCredits,
}: Props) {
  const [query, setQuery] = useState('');
  const [reviewModal, setReviewModal] = useState<ReviewModal>(null);

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
            onClick={() => setReviewModal({ course: c, mode: 'view' })}
            style={{
              fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
              border: '1px solid #555', backgroundColor: 'transparent',
              color: '#aaa', cursor: 'pointer',
            }}
          >⭐ View Reviews</button>
          <button
            type="button"
            onClick={() => setReviewModal({ course: c, mode: 'write' })}
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
          <button className="schTab isActive" type="button">Schedule 1</button>
          <button className="schTab" type="button" disabled>Schedule 2</button>
          <button className="schTab" type="button" disabled>Schedule 3</button>
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
          <div className="sectionTitle">Favorites</div>
          {favorites.length === 0 ? (
            <div className="emptyState">No favorites yet.</div>
          ) : (
            <ul className="resultList">
              {favorites.map((c) => <CourseItem key={c.id} c={c} showFavActive />)}
            </ul>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }}
          onClick={() => setReviewModal(null)}
        >
          <div
            style={{
              backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: '10px',
              padding: '24px', minWidth: '340px', maxWidth: '480px', width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>
                  {reviewModal.mode === 'view' ? '⭐ Reviews' : '✏️ Write a Review'}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{reviewModal.course.code} — {reviewModal.course.title}</div>
              </div>
              <button type="button" onClick={() => setReviewModal(null)} style={{
                background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer',
              }}>✕</button>
            </div>

            {reviewModal.mode === 'view' ? (
              <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚧</div>
                <div>Reviews coming soon.</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                  This feature is not yet connected to a backend.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Rating</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" style={{
                        width: '32px', height: '32px', borderRadius: '4px',
                        border: '1px solid #555', backgroundColor: '#2a2a3e',
                        color: '#f0c040', fontSize: '16px', cursor: 'pointer',
                      }}>{'★'}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Comment</label>
                  <textarea
                    placeholder="Share your experience with this course..."
                    style={{
                      width: '100%', minHeight: '80px', backgroundColor: '#2a2a3e',
                      border: '1px solid #555', borderRadius: '6px', color: '#fff',
                      padding: '8px', fontSize: '13px', resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button type="button" style={{
                  backgroundColor: '#A32638', color: '#fff', border: 'none',
                  padding: '8px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 'bold',
                }}>
                  Submit Review (Coming Soon)
                </button>
                <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
                  Review submission is not yet connected to a backend.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
