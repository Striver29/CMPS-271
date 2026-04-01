import { useMemo, useState, useEffect, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import type { Course } from "./types";
import { TopNav } from "./components/TopNav";
import { LeftInfoPanel } from "./components/LeftInfoPanel";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { RightSearchPanel } from "./components/RightSearchPanel";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Reviews from "./pages/Reviews";
import { supabase } from "./supabaseClient.ts";
import UpdatePassword from "./pages/UpdatePassword.tsx";
import { AIScheduler } from "./components/AiScheduler.tsx";
import GPAPage from "./pages/GPAPage";

const COURSE_COLORS = [
  "#1a5fa8",
  "#1a7a45",
  "#6b2d8b",
  "#b35a0a",
  "#0e6b5e",
  "#8a6d0b",
  "#123d6e",
  "#7a1f1f",
  "#1a6e8a",
  "#2d5a1a",
];

export default function App() {
  const appName = "AUB Course Planner";

  const [semesters, setSemesters] = useState<{ id: string; label: string }[]>(
    [],
  );
  const [semesterId, setSemesterId] = useState("");
  const semesterLabel = useMemo(
    () => semesters.find((s) => s.id === semesterId)?.label ?? "Semester",
    [semesterId, semesters],
  );

  // Fetch terms once on mount
  useEffect(() => {
    fetch("http://localhost:3001/api/terms")
      .then((res) => res.json())
      .then((data) => {
        const formatted = data.map(
          (t: { code: string; description: string }) => ({
            id: t.code,
            label: t.description,
          }),
        );
        setSemesters(formatted);
        const current = data.find((t: any) => t.is_current);
        if (current) setSemesterId(current.code);
      })
      .catch(() => setSemesters([]));
  }, []);

  const [allCourses, setAllCourses] = useState<Course[]>([]);

  // Fetch courses whenever semester changes
  useEffect(() => {
    if (!semesterId) return;
    setAllCourses([]); // clear stale courses while loading
    fetch(`http://localhost:3001/api/courses?term=${semesterId}`)
      .then((res) => res.json())
      .then((data) => {
        const formatted: Course[] = data.map((c: any) => {
          const meetings = [];
          if (c.schedule?.days && c.schedule?.time) {
            const dayNameMap: Record<string, string> = {
              monday: "M",
              tuesday: "T",
              wednesday: "W",
              thursday: "R",
              friday: "F",
              saturday: "S",
            };
            const dayChars = (c.schedule.days as string)
              .toLowerCase()
              .split(/[\s,]+/)
              .map((d: string) => dayNameMap[d])
              .filter(Boolean) as Course["meetings"][0]["days"];
            const parseMilitary = (t: string) => {
              const s = t.trim().replace(":", "");
              if (s.length === 3) return `0${s[0]}:${s.slice(1)}`;
              if (s.length === 4) return `${s.slice(0, 2)}:${s.slice(2)}`;
              return t.trim();
            };
            const timeParts = (c.schedule.time as string)
              .split("-")
              .map((t: string) => t.trim());
            if (timeParts.length === 2) {
              meetings.push({
                days: dayChars,
                start: parseMilitary(timeParts[0]),
                end: parseMilitary(timeParts[1]),
                location: c.schedule?.location ?? "",
                type: c.schedule?.type ?? "Lecture",
              });
            }
          }
          return {
            id: c.id,
            crn: String(c.crn),
            code: `${c.department} ${c.course_number}`,
            title: c.title,
            instructor: c.professors?.full_name ?? "TBA",
            campus: c.campus ?? "Main Campus",
            section: c.schedule?.section ?? "",
            credits: c.credits ?? c.creditHourHigh ?? c.creditHourLow ?? 0,
            capacity: {
              enrolled: c.enrolled_count ?? 0,
              limit: c.capacity ?? 0,
            },
            attributes: c.attributes ?? [],
            prerequisites: c.prerequisites ?? undefined,
            restrictions: c.restrictions ?? undefined,
            difficulty: c.difficulty ?? 0,
            workload: c.workload ?? 0,
            meetings,
          };
        });
        setAllCourses(formatted);
      })
      .catch(() => setAllCourses([]));
  }, [semesterId]);

  const [activeLeftTab, setActiveLeftTab] = useState<
    "welcome" | "info" | "crn"
  >("info");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [hoveredCourse, setHoveredCourse] = useState<Course | null>(null);
  const [favorites, setFavorites] = useState<Course[]>([]);
  const [customColors, setCustomColors] = useState<Map<string, string>>(
    new Map(),
  );

  // ── Schedule slots ──────────────────────────────────────────────
  const [activeSlot, setActiveSlot] = useState(1);
  const [schedules, setSchedules] = useState<Record<number, Course[]>>({
    1: [],
    2: [],
    3: [],
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  // ── Load schedules — scoped to current term ──────────────────────
  useEffect(() => {
    if (!userId || !semesterId) return;
    supabase
      .from("schedules")
      .select("slot, courses, colors")
      .eq("user_id", userId)
      .eq("term_id", semesterId) // ✅ filter by term
      .then(({ data }) => {
        const loaded: Record<number, Course[]> = { 1: [], 2: [], 3: [] };
        const loadedColors = new Map<string, string>();
        (data ?? []).forEach((row: any) => {
          loaded[row.slot] = row.courses;
          if (row.colors) {
            Object.entries(row.colors).forEach(([id, color]) => {
              loadedColors.set(id, color as string);
            });
          }
        });
        setSchedules(loaded);
        setCustomColors(loadedColors);
      });
  }, [userId, semesterId]); // ✅ re-run when term changes

  // ── Load favorites ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("favorites")
      .select("course")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!data) return;
        setFavorites(data.map((row: any) => row.course));
      });
  }, [userId]);

  const saveSlot = useCallback(
    async (slot: number, courses: Course[], colors?: Map<string, string>) => {
      if (!userId || !semesterId) return;
      const colorsObj = colors
        ? Object.fromEntries(colors)
        : Object.fromEntries(customColors);
      await supabase.from("schedules").upsert(
        {
          user_id: userId,
          term_id: semesterId, // ✅ include term_id in upsert
          slot,
          courses,
          colors: colorsObj,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,slot,term_id" }, // ✅ updated conflict key
      );
    },
    [userId, semesterId, customColors],
  );

  // ── Toggle favorite ─────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (course: Course) => {
      if (!userId) return;
      const exists = favorites.some((c) => c.id === course.id);
      if (exists) {
        setFavorites((prev) => prev.filter((c) => c.id !== course.id));
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("course_id", course.id);
      } else {
        setFavorites((prev) => [...prev, course]);
        await supabase
          .from("favorites")
          .insert({ user_id: userId, course_id: course.id, course });
      }
    },
    [userId, favorites],
  );

  const scheduled = schedules[activeSlot] ?? [];

  const toggleSchedule = (course: Course) => {
    const current = schedules[activeSlot];
    const exists = current.some((c) => c.id === course.id);
    const updated = exists
      ? current.filter((c) => c.id !== course.id)
      : [...current, course];
    const newSchedules = { ...schedules, [activeSlot]: updated };
    setSchedules(newSchedules);
    saveSlot(activeSlot, updated);
    if (!exists) {
      const alreadyFav = favorites.some((f) => f.id === course.id);
      if (!alreadyFav) toggleFavorite(course);
    }
  };

  const scheduledIds = useMemo(
    () => new Set(scheduled.map((c) => c.id)),
    [scheduled],
  );
  const selectedCrns = useMemo(() => scheduled.map((c) => c.crn), [scheduled]);
  const totalCredits = useMemo(
    () => scheduled.reduce((acc, c) => acc + (c.credits ?? 0), 0),
    [scheduled],
  );
  const [courseDifficulties, setCourseDifficulties] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    scheduled.forEach((c) => {
      const [dept, num] = c.code.split(" ");
      if (courseDifficulties[c.code] !== undefined) return;
      fetch(`http://localhost:3001/api/ratings/course/${dept}/${num}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.averages?.difficulty > 0) {
            setCourseDifficulties((prev) => ({
              ...prev,
              [c.code]: parseFloat(data.averages.difficulty),
            }));
          }
        });
    });
  }, [scheduled]);

  const averageDifficulty = useMemo(() => {
    const rated = scheduled.filter(
      (c) => courseDifficulties[c.code] !== undefined,
    );
    if (rated.length === 0) return null;
    return (
      rated.reduce((acc, c) => acc + courseDifficulties[c.code], 0) /
      rated.length
    );
  }, [scheduled, courseDifficulties]);

  const courseColorMap = useMemo(() => {
    const map = new Map<string, string>();
    scheduled.forEach((c, i) => {
      map.set(
        c.id,
        customColors.get(c.id) ?? COURSE_COLORS[i % COURSE_COLORS.length],
      );
    });
    return map;
  }, [scheduled, customColors]);

  const handleColorChange = (courseId: string, color: string) => {
    const updated = new Map(customColors).set(courseId, color);
    setCustomColors(updated);
    saveSlot(activeSlot, scheduled, updated);
  };

  const displayedCourse = hoveredCourse ?? selectedCourse;

  const selectCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveLeftTab("info");
  };

  const handleHoverCourse = (course: Course | null) => {
    setHoveredCourse(course);
    if (course) setActiveLeftTab("info");
  };

  const handleApplyAISchedule = (courses: Course[]) => {
    const newSchedules = { ...schedules, [activeSlot]: courses };
    setSchedules(newSchedules);
    saveSlot(activeSlot, courses);
    courses.forEach((c) => {
      const alreadyFav = favorites.some((f) => f.id === c.id);
      if (!alreadyFav) toggleFavorite(c);
    });
  };

  const mainApp = (
    <div className="appShell">
      <TopNav
        appName={appName}
        semesterId={semesterId}
        semesters={semesters}
        semesterLabel={semesterLabel}
        lastUpdatedText={semesterId ? semesterLabel : "Demo data"}
        onSemesterChange={setSemesterId}
        scheduledCourses={scheduled}
      />
      <div className="mainContainer">
        <LeftInfoPanel
          activeTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
          selectedCourse={displayedCourse}
          selectedCrns={selectedCrns}
        />
        <ScheduleGrid
          courses={scheduled}
          hoveredCourse={hoveredCourse}
          scheduledIds={scheduledIds}
          courseColorMap={courseColorMap}
          onSelectCourse={selectCourse}
          onHoverCourse={handleHoverCourse}
          onColorChange={handleColorChange}
          semesterLabel={semesterLabel}
        />
        <RightSearchPanel
          allCourses={allCourses}
          scheduled={scheduled}
          favorites={favorites}
          onSelectCourse={selectCourse}
          onToggleSchedule={toggleSchedule}
          onToggleFavorite={toggleFavorite}
          onHoverCourse={handleHoverCourse}
          averageDifficulty={averageDifficulty}
          totalCredits={totalCredits}
          activeSlot={activeSlot}
          onSlotChange={setActiveSlot}
        />
      </div>
      <AIScheduler
        allCourses={allCourses}
        onApplySchedule={handleApplyAISchedule}
        activeSlot={activeSlot}
      />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute>{mainApp}</ProtectedRoute>} />
      <Route
        path="/reviews"
        element={
          <ProtectedRoute>
            <Reviews />
          </ProtectedRoute>
        }
      />
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/gpa" element={<GPAPage />} />
    </Routes>
  );
}
