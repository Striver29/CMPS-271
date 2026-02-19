import { useMemo } from 'react';
import type { Course, Day, Meeting } from '../types';

const DAYS: { key: Day; label: string }[] = [
  { key: 'M', label: 'Monday' },
  { key: 'T', label: 'Tuesday' },
  { key: 'W', label: 'Wednesday' },
  { key: 'R', label: 'Thursday' },
  { key: 'F', label: 'Friday' },
  { key: 'S', label: 'Saturday' },
];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  return h * 60 + m;
}

function formatHour(h: number) {
  const h12 = h % 12 || 12;
  return `${h12}:00`;
}

type Block = {
  course: Course;
  meeting: Meeting;
  day: Day;
  startMin: number;
  endMin: number;
};

type Props = {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
};

export function ScheduleGrid({ courses, onSelectCourse }: Props) {
  const startDayMin = 8 * 60; // 8:00
  const endDayMin = 21 * 60; // 21:00
  const pxPerMin = 1; // 1px per minute
  const gridHeight = (endDayMin - startDayMin) * pxPerMin;

  const blocks = useMemo(() => {
    const out: Block[] = [];
    for (const c of courses) {
      for (const m of c.meetings) {
        const s = toMinutes(m.start);
        const e = toMinutes(m.end);
        for (const d of m.days) {
          out.push({ course: c, meeting: m, day: d, startMin: s, endMin: e });
        }
      }
    }
    return out;
  }, [courses]);

  const hourMarks = useMemo(() => {
    const marks: { at: number; label: string }[] = [];
    for (let h = 8; h <= 21; h += 1) {
      const at = (h * 60 - startDayMin) * pxPerMin;
      if (h !== 8) marks.push({ at, label: formatHour(h) });
    }
    return marks;
  }, []);

  return (
    <section className="middlePanel">
      <div className="schHeader">
        Tip: Search on the right → ☑ add courses → see them appear here. Click a block to view details on the left. Conflicts will be highlighted.
      </div>

      <div className="schDays">
        <div className="schDays__corner" />
        {DAYS.map((d) => (
          <div key={d.key} className="schDays__day">{d.label}</div>
        ))}
      </div>

      <div className="schGrid" style={{ height: gridHeight }}>
        {/* Left time labels */}
        <div className="schTimes">
          {hourMarks.map((m) => (
            <div key={m.label} className="schTimes__mark" style={{ top: m.at }}>
              {m.label}
            </div>
          ))}
        </div>

        {/* Vertical day columns + horizontal hour lines */}
        <div className="schCanvas" style={{ height: gridHeight }}>
          <div className="schCanvas__columns">
            {DAYS.map((d) => (
              <div key={d.key} className="schCanvas__col" />
            ))}
          </div>
          {hourMarks.map((m) => (
            <div key={m.label} className="schCanvas__hline" style={{ top: m.at }} />
          ))}

          {/* Blocks */}
          {blocks.map((b) => {
            const dayIndex = DAYS.findIndex((d) => d.key === b.day);
            const top = (b.startMin - startDayMin) * pxPerMin;
            const height = Math.max(18, (b.endMin - b.startMin) * pxPerMin);
            return (
              <button
                key={`${b.course.id}-${b.day}-${b.startMin}`}
                className="courseBlock"
                style={{
                  left: `calc(${dayIndex} * (100% / 6))`,
                  width: `calc(100% / 6)`,
                  top,
                  height,
                }}
                type="button"
                onClick={() => onSelectCourse(b.course)}
                title={`${b.course.code} ${b.meeting.start}-${b.meeting.end}`}
              >
                <span className="courseBlock__line1">{b.course.code}</span>
                <span className="courseBlock__line2">{b.meeting.start}-{b.meeting.end}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
