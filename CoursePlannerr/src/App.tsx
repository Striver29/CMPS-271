import { Suspense, lazy, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import type { Course } from "./types";
import { TopNav } from "./components/TopNav";
import { LeftInfoPanel } from "./components/LeftInfoPanel";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { RightSearchPanel } from "./components/RightSearchPanel";
import ProtectedRoute from "./components/ProtectedRoute";
import { supabase } from "./supabaseClient.ts";
import { AIScheduler } from "./components/AiScheduler.tsx";
import AdminRoute from "./components/AdminRoute";
import { mapApiCoursesToCourses } from "./utils/courseApi.ts";

const API_URL = import.meta.env.VITE_API_URL || "";
const COURSE_CACHE_PREFIX = "uniflow:courses:";
const TERMS_CACHE_KEY = "uniflow:terms";
const EMPTY_COURSES: Course[] = [];

type TermRecord = {
  code: string;
  description: string;
  is_current?: boolean;
};

type TermOption = {
  id: string;
  label: string;
};

type RawCourse = Record<string, unknown>;

type SavedScheduleRow = {
  slot: number;
  courses: Course[] | null;
  colors: Record<string, string> | null;
};

type FavoriteRow = {
  course: Course | null;
};

// ── Mobile tab type ──────────────────────────────────────────
type MobileTab = "search" | "schedule";

const Login = lazy(() => import("./pages/Login"));
const Reviews = lazy(() => import("./pages/Reviews"));
const EmptyClasses = lazy(() => import("./pages/EmptyClasses.tsx"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword.tsx"));
const GPAPage = lazy(() => import("./pages/GPAPage"));
const GradeCalculator = lazy(() => import("./components/GradeCalculator"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));

function readCachedJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeCachedJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode or if quota is exhausted.
  }
}

function formatTermOptions(terms: TermRecord[]): TermOption[] {
  return terms.map((term) => ({
    id: term.code,
    label: term.description,
  }));
}

function PageFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        color: "var(--muted)",
        fontSize: 14,
      }}
    >
      Loading...
    </div>
  );
}

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
  const appName = "Uniflow";
  const initialTerms = useMemo(
    () => readCachedJson<TermRecord[]>(TERMS_CACHE_KEY) ?? [],
    [],
  );

  const [semesters, setSemesters] = useState<TermOption[]>(() =>
    formatTermOptions(initialTerms),
  );
  const [semesterId, setSemesterId] = useState(
    () => initialTerms.find((term) => term.is_current)?.code ?? "",
  );
  const semesterLabel = useMemo(
    () => semesters.find((s) => s.id === semesterId)?.label ?? "Semester",
    [semesterId, semesters],
  );

  useEffect(() => {
    fetch(`${API_URL}/api/terms`)
      .then((res) => res.json())
      .then((data: TermRecord[]) => {
        writeCachedJson(TERMS_CACHE_KEY, data);
        setSemesters(formatTermOptions(data));
        const current = data.find((term) => term.is_current);
        if (current) setSemesterId(current.code);
      })
      .catch(() => setSemesters([]));
  }, []);

  const [allCourses, setAllCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!semesterId) return;
    const cacheKey = `${COURSE_CACHE_PREFIX}${semesterId}`;
    const cachedCourses = readCachedJson<RawCourse[]>(cacheKey);
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setAllCourses(
        cachedCourses?.length ? mapApiCoursesToCourses(cachedCourses) : [],
      );
    });

    const controller = new AbortController();
    fetch(`${API_URL}/api/courses?term=${semesterId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: RawCourse[]) => {
        writeCachedJson(cacheKey, data);
        setAllCourses(mapApiCoursesToCourses(data));
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && !cachedCourses?.length) {
          setAllCourses([]);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
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

  const [activeSlot, setActiveSlot] = useState(1);
  const [schedules, setSchedules] = useState<Record<number, Course[]>>({
    1: [],
    2: [],
    3: [],
  });
  const [userId, setUserId] = useState<string | null>(null);

  // ── MOBILE: which panel is visible ──────────────────────────
  const [mobileTab, setMobileTab] = useState<MobileTab>("search");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!userId || !semesterId) return;
    supabase
      .from("schedules")
      .select("slot, courses, colors")
      .eq("user_id", userId)
      .eq("term_id", semesterId)
      .then(({ data }) => {
        const loaded: Record<number, Course[]> = { 1: [], 2: [], 3: [] };
        const loadedColors = new Map<string, string>();
        ((data ?? []) as SavedScheduleRow[]).forEach((row) => {
          loaded[row.slot] = row.courses ?? [];
          if (row.colors) {
            Object.entries(row.colors).forEach(([id, color]) => {
              loadedColors.set(id, color);
            });
          }
        });
        setSchedules(loaded);
        setCustomColors(loadedColors);
      });
  }, [userId, semesterId]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("favorites")
      .select("course")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!data) return;
        setFavorites(
          (data as FavoriteRow[])
            .map((row) => row.course)
            .filter((course): course is Course => Boolean(course)),
        );
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
          term_id: semesterId,
          slot,
          courses,
          colors: colorsObj,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,slot,term_id" },
      );
    },
    [userId, semesterId, customColors],
  );

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

  const scheduled = useMemo(
    () => schedules[activeSlot] ?? EMPTY_COURSES,
    [schedules, activeSlot],
  );

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
  const courseDifficultiesRef = useRef(courseDifficulties);
  const difficultyRequestsRef = useRef(new Set<string>());

  useEffect(() => {
    courseDifficultiesRef.current = courseDifficulties;
  }, [courseDifficulties]);

  useEffect(() => {
    scheduled.forEach((c) => {
      const [dept, num] = c.code.split(" ");
      if (
        courseDifficultiesRef.current[c.code] !== undefined ||
        difficultyRequestsRef.current.has(c.code)
      ) {
        return;
      }
      difficultyRequestsRef.current.add(c.code);
      fetch(`${API_URL}/api/ratings/course/${dept}/${num}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.averages?.difficulty > 0) {
            setCourseDifficulties((prev) => {
              if (prev[c.code] !== undefined) return prev;
              return {
                ...prev,
                [c.code]: parseFloat(data.averages.difficulty),
              };
            });
          }
          difficultyRequestsRef.current.delete(c.code);
        })
        .catch(() => {
          difficultyRequestsRef.current.delete(c.code);
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
    const current = schedules[activeSlot] ?? [];
    const currentIds = new Set(current.map((course) => course.id));
    const coursesToAdd = courses.filter((course) => !currentIds.has(course.id));
    const mergedCourses = [...current, ...coursesToAdd];
    const newSchedules = { ...schedules, [activeSlot]: mergedCourses };
    setSchedules(newSchedules);
    saveSlot(activeSlot, mergedCourses);
    coursesToAdd.forEach((c) => {
      const alreadyFav = favorites.some((f) => f.id === c.id);
      if (!alreadyFav) toggleFavorite(c);
    });
  };

  const mainApp = (
    <div className="appShell" style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopNav
        appName={appName}
        semesterId={semesterId}
        semesters={semesters}
        semesterLabel={semesterLabel}
        lastUpdatedText={semesterId ? semesterLabel : "Demo data"}
        onSemesterChange={setSemesterId}
        scheduledCourses={scheduled}
        activePage="home"
      />

      {/* ── MOBILE: tab switcher bar ── */}
      <div className="mobileTabs">
        <button
          className={`mobileTab${mobileTab === "search" ? " isActive" : ""}`}
          onClick={() => setMobileTab("search")}
        >
          🔍 Search
        </button>
        <button
          className={`mobileTab${mobileTab === "schedule" ? " isActive" : ""}`}
          onClick={() => setMobileTab("schedule")}
        >
          📅 Schedule
        </button>
      </div>

      <div className="mainContainer" style={{ flex: 1, minHeight: 0 }}>
        {/* Left info panel — hidden on mobile via CSS */}
        <LeftInfoPanel
          activeTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
          selectedCourse={displayedCourse}
          selectedCrns={selectedCrns}
        />

        {/* Schedule — hidden on mobile when search tab is active */}
        <div
          style={{
            display: "contents",
          }}
          className={`mobilePanel mobilePanel--schedule${mobileTab === "schedule" ? " isVisible" : ""}`}
        >
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
        </div>

        {/* Search — hidden on mobile when schedule tab is active */}
        <div
          style={{
            display: "contents",
          }}
          className={`mobilePanel mobilePanel--search${mobileTab === "search" ? " isVisible" : ""}`}
        >
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
      </div>

      <AIScheduler
        allCourses={allCourses}
        scheduledCourses={scheduled}
        onApplySchedule={handleApplyAISchedule}
        activeSlot={activeSlot}
      />
    </div>
  );

  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route
          path="/empty-classes"
          element={
            <ProtectedRoute>
              <EmptyClasses />
            </ProtectedRoute>
          }
        />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/gpa" element={<GPAPage />} />
        <Route path="/grade-calculator" element={<GradeCalculator />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPortal />
            </AdminRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
