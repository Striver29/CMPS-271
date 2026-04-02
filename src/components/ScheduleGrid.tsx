import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { Course, Day, Meeting } from '../types';
import jsPDF from 'jspdf';

const COURSE_COLORS = [
  "#1a5fa8","#1a7a45","#6b2d8b","#b35a0a","#0e6b5e",
  "#8a6d0b","#123d6e","#7a1f1f","#1a6e8a","#2d5a1a",
];

const COLOR_GRID = [
  "#1a5fa8","#1a7a45","#6b2d8b","#b35a0a","#0e6b5e",
  "#8a6d0b","#123d6e","#7a1f1f","#1a6e8a","#2d5a1a",
  "#5a1a6e","#6e1a3a","#1a4a6e","#3a6e1a","#6e4a1a",
  "#2a2a7a","#7a2a2a","#2a7a2a","#7a5a1a","#1a5a5a",
];

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
function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

type Block = {
  course: Course;
  meeting: Meeting;
  day: Day;
  startMin: number;
  endMin: number;
  addedIndex: number;
  isConflict: boolean;
  hidden: boolean;
  zIndex: number;
};

type ContextMenu = { x: number; y: number; courseId: string };
type ReviewModal = { course: Course; mode: 'write' | 'view' } | null;

type Props = {
  scheduledIds: Set<string>;
  courses: Course[];
  hoveredCourse: Course | null;
  onSelectCourse: (course: Course) => void;
  onHoverCourse: (course: Course | null) => void;
  courseColorMap: Map<string, string>;
  onColorChange: (courseId: string, color: string) => void;
  semesterLabel?: string;
};

export function ScheduleGrid({ courses, hoveredCourse, scheduledIds, onSelectCourse, onHoverCourse, courseColorMap, onColorChange, semesterLabel = 'Schedule' }: Props) {
  const startDayMin = 8 * 60;
  const endDayMin = 21 * 60;
  const pxPerMin = 1;
  const gridHeight = (endDayMin - startDayMin) * pxPerMin;

  const [tipVisible, setTipVisible] = useState(true);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [reviewModal, setReviewModal] = useState<ReviewModal>(null);
  const [rgbInput, setRgbInput] = useState({ r: 26, g: 95, b: 168 });
  const [colorTab, setColorTab] = useState<'picker' | 'rgb'>('picker');
  const [hue, setHue] = useState(220);
  const [pickerPos, setPickerPos] = useState({ x: 0.3, y: 0.3 });
  const gradientRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync RGB inputs when context menu opens
  useEffect(() => {
    if (contextMenu) {
      const currentColor = courseColorMap.get(contextMenu.courseId) ?? '#1a5fa8';
      const { r, g, b } = hexToRgb(currentColor);
      setRgbInput({ r, g, b });
      setColorTab('picker');
      // Sync hue and picker position from current color
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max !== 0) {
        const s = (max - min) / max;
        const v = max / 255;
        setPickerPos({ x: s, y: 1 - v });
      }
    }
  }, [contextMenu]);

  const blocks = useMemo(() => {
    const raw: Block[] = [];
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      for (const m of c.meetings) {
        const s = toMinutes(m.start);
        const e = toMinutes(m.end);
        for (const d of m.days) {
          raw.push({ course: c, meeting: m, day: d, startMin: s, endMin: e, addedIndex: i, isConflict: false, hidden: false, zIndex: i + 1 });
        }
      }
    }
    for (let i = 0; i < raw.length; i++) {
      for (let j = i + 1; j < raw.length; j++) {
        const a = raw[i]; const b = raw[j];
        if (a.day !== b.day || !(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
        raw[i].isConflict = true; raw[j].isConflict = true;
        const durA = a.endMin - a.startMin, durB = b.endMin - b.startMin;
        if (a.addedIndex > b.addedIndex) {
          if (durB > durA) { raw[i].zIndex = b.addedIndex + 1; raw[j].zIndex = a.addedIndex + 2; }
          else { raw[i].zIndex = a.addedIndex + 2; raw[j].zIndex = b.addedIndex + 1; }
        } else {
          if (durA > durB) { raw[j].zIndex = a.addedIndex + 1; raw[i].zIndex = b.addedIndex + 2; }
          else { raw[j].zIndex = b.addedIndex + 2; raw[i].zIndex = a.addedIndex + 1; }
        }
      }
    }
    for (let i = 0; i < raw.length; i++) {
      if (!raw[i].isConflict) continue;
      for (let j = i + 1; j < raw.length; j++) {
        if (!raw[j].isConflict || raw[i].day !== raw[j].day) continue;
        if (!(raw[i].startMin < raw[j].endMin && raw[j].startMin < raw[i].endMin)) continue;
        if (raw[i].zIndex < raw[j].zIndex) raw[i].hidden = true; else raw[j].hidden = true;
      }
    }
    return raw;
  }, [courses]);

  const occupiedSlots = useMemo(() =>
    blocks.filter(b => !b.hidden).map(b => ({ day: b.day, startMin: b.startMin, endMin: b.endMin })),
    [blocks]
  );

  const previewBlocks = useMemo(() => {
    if (!hoveredCourse || scheduledIds.has(hoveredCourse.id)) return [];
    const out: { meeting: Meeting; day: Day; startMin: number; endMin: number; isConflict: boolean }[] = [];
    for (const m of hoveredCourse.meetings) {
      const s = toMinutes(m.start), e = toMinutes(m.end);
      for (const d of m.days) {
        const hasConflict = occupiedSlots.some(slot => slot.day === d && s < slot.endMin && slot.startMin < e);
        out.push({ meeting: m, day: d, startMin: s, endMin: e, isConflict: hasConflict });
      }
    }
    return out;
  }, [hoveredCourse, occupiedSlots, scheduledIds]);

  const hourMarks = useMemo(() => {
    const marks: { at: number; label: string }[] = [];
    for (let h = 8; h <= 21; h++) {
      const at = (h * 60 - startDayMin) * pxPerMin;
      if (h !== 8) marks.push({ at, label: formatHour(h) });
    }
    return marks;
  }, []);

  const handleRightClick = (e: React.MouseEvent, courseId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, courseId });
  };

  const handlePickColor = (color: string) => {
    if (contextMenu) { onColorChange(contextMenu.courseId, color); setContextMenu(null); }
  };

  const handleRgbApply = () => {
    const hex = rgbToHex(rgbInput.r, rgbInput.g, rgbInput.b);
    handlePickColor(hex);
  };

  // PDF Export using jsPDF
  const handleExportPdf = () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    const PAGE_W = 841.89;
    const PAGE_H = 595.28;
    const MARGIN = 20;
    const TIME_W = 36;
    const HEADER_H = 28;
    const TITLE_H = 24;
    const GRID_X = MARGIN + TIME_W;
    const GRID_Y = MARGIN + TITLE_H + HEADER_H;
    const GRID_W = PAGE_W - MARGIN - GRID_X;
    const GRID_H = PAGE_H - GRID_Y - MARGIN;
    const DAY_W = GRID_W / 6;

    // Smart crop: find earliest and latest course times, rounded to hour
    const visibleBlocks = blocks.filter(b => !b.hidden);
    const minHour = visibleBlocks.length > 0
      ? Math.max(7, Math.floor(Math.min(...visibleBlocks.map(b => b.startMin)) / 60) - 1)
      : 8;
    const maxHour = visibleBlocks.length > 0
      ? Math.min(22, Math.ceil(Math.max(...visibleBlocks.map(b => b.endMin)) / 60) + 1)
      : 21;

    const START_MIN = minHour * 60;
    const END_MIN = maxHour * 60;
    const PX_PER_MIN = GRID_H / (END_MIN - START_MIN);

    // Background
    pdf.setFillColor(15, 18, 23);
    pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(233, 238, 247);
    pdf.text(semesterLabel, PAGE_W / 2, MARGIN + 16, { align: 'center' });

    // Day header background
    pdf.setFillColor(11, 14, 19);
    pdf.rect(GRID_X, MARGIN + TITLE_H, GRID_W, HEADER_H, 'F');

    // Day headers
    DAYS.forEach((d, i) => {
      const x = GRID_X + i * DAY_W;
      pdf.setDrawColor(38, 44, 54);
      pdf.setLineWidth(0.5);
      pdf.line(x + DAY_W, MARGIN + TITLE_H, x + DAY_W, MARGIN + TITLE_H + HEADER_H);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(233, 238, 247);
      pdf.text(d.label, x + DAY_W / 2, MARGIN + TITLE_H + HEADER_H / 2 + 3, { align: 'center' });
    });

    // Grid border
    pdf.setDrawColor(38, 44, 54);
    pdf.setLineWidth(0.5);
    pdf.rect(GRID_X, GRID_Y, GRID_W, GRID_H);

    // Hour lines + time labels
    for (let h = minHour; h <= maxHour; h++) {
      const y = GRID_Y + (h * 60 - START_MIN) * PX_PER_MIN;
      pdf.setDrawColor(38, 44, 54);
      pdf.setLineWidth(0.4);
      pdf.line(GRID_X, y, GRID_X + GRID_W, y);
      if (h !== minHour) {
        const h12 = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(170, 180, 196);
        pdf.text(`${h12}:00`, MARGIN + TIME_W - 4, y + 3, { align: 'right' });
      }
    }

    // Vertical column separators
    DAYS.forEach((_, i) => {
      const x = GRID_X + i * DAY_W;
      pdf.setDrawColor(38, 44, 54);
      pdf.setLineWidth(0.4);
      pdf.line(x, GRID_Y, x, GRID_Y + GRID_H);
    });

    // Course blocks
    visibleBlocks.forEach(b => {
      const dayIndex = DAYS.findIndex(d => d.key === b.day);
      if (dayIndex === -1) return;

      const bx = GRID_X + dayIndex * DAY_W + 2;
      const by = GRID_Y + (b.startMin - START_MIN) * PX_PER_MIN + 1;
      const bw = DAY_W - 4;
      const bh = Math.max(16, (b.endMin - b.startMin) * PX_PER_MIN - 2);

      const hex = courseColorMap.get(b.course.id) ?? '#1a5fa8';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const bv = parseInt(hex.slice(5, 7), 16);

      pdf.setFillColor(r, g, bv);
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(bx, by, bw, bh, 4, 4, 'FD');

      const cx = bx + bw / 2;
      let ty = by + bh / 2 - (bh > 32 ? 8 : bh > 22 ? 4 : 0);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(b.course.code, cx, ty, { align: 'center', maxWidth: bw - 4 });
      ty += 10;

      if (bh > 24) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(230, 230, 230);
        pdf.text(b.course.title, cx, ty, { align: 'center', maxWidth: bw - 4 });
        ty += 9;
      }

      if (bh > 36) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(210, 215, 225);
        pdf.text(`${formatTime(b.meeting.start)}–${formatTime(b.meeting.end)}`, cx, ty, { align: 'center', maxWidth: bw - 4 });
        ty += 9;
      }

      if (bh > 50 && b.meeting.location) {
        pdf.setFontSize(6.5);
        pdf.setTextColor(195, 200, 215);
        pdf.text(b.meeting.location, cx, ty, { align: 'center', maxWidth: bw - 4 });
      }
    });

    const filename = `${semesterLabel.replace(/[^a-z0-9]/gi, '_')}_schedule.pdf`;
    pdf.save(filename);
  };

  const pulseStyle = `
    @keyframes conflictPulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 2px #ff4444; }
      50% { opacity: 0.75; box-shadow: 0 0 8px 3px #ff4444; }
    }
  `;

  return (
    <section className="middlePanel">
      <style>{pulseStyle}</style>

      <div className="schHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {tipVisible ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Tip: Search on the right → ☑ add courses → see them appear here. Right-click to change color.
            <button
              type="button"
              onClick={() => setTipVisible(false)}
              style={{
                background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
                fontSize: '14px', lineHeight: 1, padding: '0 2px',
              }}
              aria-label="Dismiss tip"
            >✕</button>
          </span>
        ) : <span />}
        <button
          type="button"
          onClick={handleExportPdf}
          style={{
            backgroundColor: '#A32638', color: '#fff', border: 'none',
            padding: '5px 12px', borderRadius: '5px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '10px',
          }}
        >
          PDF ↗
        </button>
      </div>

      <div className="schDays">
        <div className="schDays__corner" />
        {DAYS.map((d) => <div key={d.key} className="schDays__day">{d.label}</div>)}
      </div>

      <div className="schGrid" ref={gridRef} style={{ height: gridHeight }}>
        <div className="schTimes">
          {hourMarks.map((m) => (
            <div key={m.label} className="schTimes__mark" style={{ top: m.at }}>{m.label}</div>
          ))}
        </div>

        <div className="schCanvas" style={{ height: gridHeight }}>
          <div className="schCanvas__columns">
            {DAYS.map((d) => <div key={d.key} className="schCanvas__col" />)}
          </div>
          {hourMarks.map((m) => <div key={m.label} className="schCanvas__hline" style={{ top: m.at }} />)}

          {/* Preview blocks */}
          {previewBlocks.map((b, idx) => {
            const dayIndex = DAYS.findIndex(d => d.key === b.day);
            if (dayIndex === -1) return null;
            const top = (b.startMin - startDayMin) * pxPerMin;
            const height = Math.max(18, (b.endMin - b.startMin) * pxPerMin);
            return (
              <div key={`preview-${idx}`} style={{
                position: 'absolute', left: `calc(${dayIndex} * (100% / 6))`, width: `calc(100% / 6)`,
                top, height,
                backgroundColor: b.isConflict ? 'rgba(163,38,56,0.15)' : 'transparent',
                border: b.isConflict ? '2px dashed #A32638' : '2px dashed rgba(255,255,255,0.35)',
                borderRadius: '4px', zIndex: 999, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxSizing: 'border-box', overflow: 'hidden',
              }}>
                <span style={{ fontSize: '10px', color: b.isConflict ? '#ff6666' : 'rgba(255,255,255,0.55)', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>
                  {hoveredCourse?.code}
                </span>
                <span style={{ fontSize: '9px', color: b.isConflict ? '#ff6666' : 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                  {formatTime(b.meeting.start)}–{formatTime(b.meeting.end)}
                </span>
                {b.isConflict && <span style={{ fontSize: '9px', color: '#ff6666' }}>⚠ Conflict</span>}
              </div>
            );
          })}

          {/* Scheduled blocks */}
          {blocks.filter(b => !b.hidden).map((b) => {
            const dayIndex = DAYS.findIndex(d => d.key === b.day);
            if (dayIndex === -1) return null;
            const top = (b.startMin - startDayMin) * pxPerMin;
            const height = Math.max(18, (b.endMin - b.startMin) * pxPerMin);
            const blockKey = `${b.course.id}-${b.day}-${b.startMin}`;
            const color = courseColorMap.get(b.course.id) ?? '#1a5fa8';
            const isHovered = hoveredBlock === blockKey;
            return (
              <button key={blockKey} className="courseBlock" style={{
                left: `calc(${dayIndex} * (100% / 6))`, width: `calc(100% / 6)`,
                top, height,
                zIndex: isHovered ? 1000 : b.zIndex,
                backgroundColor: color,
                animation: b.isConflict ? 'conflictPulse 1.5s ease-in-out infinite' : undefined,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', boxSizing: 'border-box', padding: '2px 4px', overflow: 'hidden',
                outline: isHovered ? '2px solid white' : undefined,
              }}
                type="button"
                onClick={() => onSelectCourse(b.course)}
                onContextMenu={(e) => handleRightClick(e, b.course.id)}
                onMouseEnter={() => { setHoveredBlock(blockKey); onHoverCourse(b.course); }}
                onMouseLeave={() => { setHoveredBlock(null); onHoverCourse(null); }}
                title={`${b.course.code} – right-click to change color`}
              >
                <span style={{ textAlign: 'center', width: '100%', fontWeight: 'bold', fontSize: '11px' }}>{b.course.code}</span>
                <span style={{ textAlign: 'center', width: '100%', fontSize: '9px', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>{b.course.title}</span>
                <span style={{ textAlign: 'center', width: '100%', fontSize: '10px' }}>{formatTime(b.meeting.start)}–{formatTime(b.meeting.end)}</span>
                {b.isConflict && <span style={{ fontSize: '9px', color: '#fff', opacity: 0.85 }}>⚠ Conflict</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right-click color picker */}
      {contextMenu && (
        <div ref={contextMenuRef} style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x,
          backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: '8px',
          padding: '10px', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: '180px',
        }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {(['picker', 'rgb'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setColorTab(tab)} style={{
                flex: 1, padding: '4px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                backgroundColor: colorTab === tab ? '#A32638' : '#333', color: '#fff', fontSize: '11px',
              }}>
                {tab === 'picker' ? '🎨 Picker' : 'RGB'}
              </button>
            ))}
          </div>

          {colorTab === 'picker' && (() => {
            // Compute hue color
            const hueColor = `hsl(${hue}, 100%, 50%)`;
            // Compute color from hue + picker position (saturation, value)
            const sat = pickerPos.x;
            const val = 1 - pickerPos.y;
            const c2 = val * sat;
            const x2 = c2 * (1 - Math.abs(((hue / 60) % 2) - 1));
            const m2 = val - c2;
            let rr = 0, gg = 0, bb = 0;
            if (hue < 60) { rr = c2; gg = x2; }
            else if (hue < 120) { rr = x2; gg = c2; }
            else if (hue < 180) { gg = c2; bb = x2; }
            else if (hue < 240) { gg = x2; bb = c2; }
            else if (hue < 300) { rr = x2; bb = c2; }
            else { rr = c2; bb = x2; }
            const pr = Math.round((rr + m2) * 255);
            const pg = Math.round((gg + m2) * 255);
            const pb = Math.round((bb + m2) * 255);
            const pickedHex = rgbToHex(pr, pg, pb);

            const handleGradientClick = (e: React.MouseEvent<HTMLDivElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
              setPickerPos({ x, y });
            };
            const handleHueClick = (e: React.MouseEvent<HTMLDivElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
              setHue(Math.round(y * 360));
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* 2D gradient */}
                  <div
                    onClick={handleGradientClick}
                    style={{
                      width: '160px', height: '120px', position: 'relative',
                      background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`,
                      borderRadius: '4px', cursor: 'crosshair', flexShrink: 0,
                    }}
                  >
                    {/* Crosshair */}
                    <div style={{
                      position: 'absolute',
                      left: `calc(${pickerPos.x * 100}% - 6px)`,
                      top: `calc(${pickerPos.y * 100}% - 6px)`,
                      width: '12px', height: '12px',
                      borderRadius: '50%',
                      border: '2px solid #fff',
                      boxShadow: '0 0 2px rgba(0,0,0,0.8)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                  {/* Hue strip */}
                  <div
                    onClick={handleHueClick}
                    style={{
                      width: '16px', height: '120px', flexShrink: 0,
                      background: 'linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                      borderRadius: '4px', cursor: 'ns-resize', position: 'relative',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: `calc(${(hue / 360) * 100}% - 3px)`,
                      left: '-2px', right: '-2px', height: '6px',
                      border: '2px solid #fff',
                      borderRadius: '2px',
                      boxShadow: '0 0 2px rgba(0,0,0,0.8)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                </div>
                {/* Preview + apply */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: pickedHex, border: '1px solid #555', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#aaa', flex: 1 }}>{pickedHex.toUpperCase()}</span>
                  <button type="button" onClick={() => handlePickColor(pickedHex)} style={{
                    padding: '6px 10px', backgroundColor: '#A32638', color: '#fff',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                  }}>Apply</button>
                </div>
              </div>
            );
          })()}

          {colorTab === 'rgb' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['r', 'g', 'b'] as const).map(ch => (
                <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: ch === 'r' ? '#ff6666' : ch === 'g' ? '#66ff66' : '#6699ff', width: '12px', fontWeight: 'bold', fontSize: '12px' }}>
                    {ch.toUpperCase()}
                  </span>
                  <input type="number" min="0" max="255" value={rgbInput[ch]}
                    onChange={e => setRgbInput(prev => ({ ...prev, [ch]: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) }))}
                    style={{ flex: 1, backgroundColor: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '4px 6px', fontSize: '12px' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: rgbToHex(rgbInput.r, rgbInput.g, rgbInput.b), border: '1px solid #555', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#aaa', flex: 1 }}>{rgbToHex(rgbInput.r, rgbInput.g, rgbInput.b).toUpperCase()}</span>
                <button type="button" onClick={handleRgbApply} style={{
                  padding: '6px 10px', backgroundColor: '#A32638', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                }}>Apply</button>
              </div>
            </div>
          )}

          {/* Divider + review actions */}
          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '10px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(() => {
              const course = courses.find(c => c.id === contextMenu!.courseId);
              if (!course) return null;
              return (
                <>
                  <button type="button" onClick={() => { setReviewModal({ course, mode: 'view' }); setContextMenu(null); }} style={{
                    width: '100%', padding: '6px 8px', textAlign: 'left', backgroundColor: 'transparent',
                    border: '1px solid #444', borderRadius: '5px', color: '#ccc', cursor: 'pointer', fontSize: '12px',
                  }}>⭐ View Reviews</button>
                  <button type="button" onClick={() => { setReviewModal({ course, mode: 'write' }); setContextMenu(null); }} style={{
                    width: '100%', padding: '6px 8px', textAlign: 'left', backgroundColor: 'transparent',
                    border: '1px solid #444', borderRadius: '5px', color: '#ccc', cursor: 'pointer', fontSize: '12px',
                  }}>✏️ Write a Review</button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }} onClick={() => setReviewModal(null)}>
          <div style={{
            backgroundColor: '#1e1e2e', border: '1px solid #444', borderRadius: '10px',
            padding: '24px', minWidth: '340px', maxWidth: '480px', width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>
                  {reviewModal.mode === 'view' ? '⭐ Reviews' : '✏️ Write a Review'}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{reviewModal.course.code} – {reviewModal.course.title}</div>
              </div>
              <button type="button" onClick={() => setReviewModal(null)} style={{
                background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer',
              }}>✕</button>
            </div>
            {reviewModal.mode === 'view' ? (
              <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚧</div>
                <div>Reviews coming soon.</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>This feature is not yet connected to a backend.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Rating</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" style={{
                        width: '32px', height: '32px', borderRadius: '4px', border: '1px solid #555',
                        backgroundColor: '#2a2a3e', color: '#f0c040', fontSize: '16px', cursor: 'pointer',
                      }}>★</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '4px' }}>Comment</label>
                  <textarea placeholder="Share your experience..." style={{
                    width: '100%', minHeight: '80px', backgroundColor: '#2a2a3e',
                    border: '1px solid #555', borderRadius: '6px', color: '#fff',
                    padding: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box',
                  }} />
                </div>
                <button type="button" style={{
                  backgroundColor: '#A32638', color: '#fff', border: 'none',
                  padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                }}>Submit Review (Coming Soon)</button>
                <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>Review submission is not yet connected to a backend.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
