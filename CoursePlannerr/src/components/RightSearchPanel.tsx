import { useMemo, useState } from 'react';
import type { Course } from '../types';

type Props = {
  allCourses: Course[];
  scheduled: Course[];
  favorites: Course[];
  onSelectCourse: (course: Course) => void;
  onToggleSchedule: (course: Course) => void;
  onToggleFavorite: (course: Course) => void;
  averageDifficulty: number | null;
  totalCredits: number;
};

export function RightSearchPanel({
  allCourses,
  scheduled,
  favorites,
  onSelectCourse,
  onToggleSchedule,
  onToggleFavorite,
  averageDifficulty,
  totalCredits,
}: Props) {
  const [query, setQuery] = useState('');

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

  return (
    <aside className="rightPanel">
      <div className="rightPanel__top">
        <div className="schTabs" role="tablist" aria-label="Schedules">
          <button className="schTab isActive" type="button">Schedule 1</button>
          <button className="schTab" type="button" disabled>Schedule 2</button>
          <button className="schTab" type="button" disabled>Schedule 3</button>
          <button className="schTab" type="button" title="Settings" disabled>⚙️</button>
          <button className="schTab" type="button" title="Export PDF" disabled>PDF ↗</button>
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
              {results.map((c) => {
                const inSchedule = scheduledIds.has(c.id);
                const isFav = favoriteIds.has(c.id);
                return (
                  <li key={c.id} className="resultItem">
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
                    >
                      <div className="resultMain__line1">{c.crn} {c.code} — {c.section} <span className="muted">{c.instructor}</span></div>
                      <div className="resultMain__line2 muted">{c.title}</div>
                    </button>

                    <button
                      className={`resultFav ${isFav ? 'isOn' : ''}`}
                      type="button"
                      onClick={() => onToggleFavorite(c)}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      ★
                    </button>
                  </li>
                );
              })}
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
              {favorites.map((c) => {
                const inSchedule = scheduledIds.has(c.id);
                return (
                  <li key={c.id} className="resultItem">
                    <button
                      className={`resultAction ${inSchedule ? 'isOn' : ''}`}
                      type="button"
                      onClick={() => onToggleSchedule(c)}
                      title={inSchedule ? 'Remove from schedule' : 'Add to schedule'}
                    >
                      {inSchedule ? '☑' : '☐'}
                    </button>

                    <button className="resultMain" type="button" onClick={() => onSelectCourse(c)}>
                      <div className="resultMain__line1">{c.crn} {c.code} — {c.section} <span className="muted">{c.instructor}</span></div>
                      <div className="resultMain__line2 muted">{c.title}</div>
                    </button>

                    <button className="resultFav isOn" type="button" onClick={() => onToggleFavorite(c)} title="Remove from favorites">
                      ★
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
