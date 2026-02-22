import { useMemo, useState, useEffect } from 'react';
import './App.css';
import type { Course } from './types';
import { TopNav } from './components/TopNav';
import { LeftInfoPanel } from './components/LeftInfoPanel';
import { ScheduleGrid } from './components/ScheduleGrid';
import { RightSearchPanel } from './components/RightSearchPanel';

export default function App() {
  const appName = 'AUB Course Planner';

const [semesters, setSemesters] = useState<{ id: string; label: string }[]>([]);
const [semesterId, setSemesterId] = useState('');
const semesterLabel = useMemo(
  () => semesters.find((s) => s.id === semesterId)?.label ?? 'Semester',
  [semesterId, semesters]
);

useEffect(() => {
  fetch('http://localhost:3001/api/terms')
    .then(res => res.json())
    .then((data) => {
      const formatted = data.map((t: { code: string; description: string }) => ({
        id: t.code,
        label: t.description
      }));
      setSemesters(formatted);
      const current = data.find((t: any) => t.is_current);
      if (current) setSemesterId(current.code);
    });
}, []);

const [allCourses, setAllCourses] = useState<Course[]>([]);

useEffect(() => {
  if (!semesterId) return;
  fetch(`http://localhost:3001/api/courses?term=${semesterId}`)
    .then(res => res.json())
    .then((data) => {
      const formatted = data.map((c: any) => ({
        id: c.id,
        crn: c.crn,
        code: `${c.department} ${c.course_number}`,
        title: c.title,
        credits: c.credits,
        instructor: c.professors?.full_name ?? 'TBA',
        section: c.schedule?.section ?? '',
        days: c.schedule?.days ?? '',
        time: c.schedule?.time ?? '',
        location: c.schedule?.location ?? '',
        difficulty: 0,
        seatsAvailable: c.capacity - c.enrolled_count,
        maxEnrollment: c.capacity,
      }));
      setAllCourses(formatted);
    });
}, [semesterId]);

  const [activeLeftTab, setActiveLeftTab] = useState<'welcome' | 'info' | 'crn'>('info');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [scheduled, setScheduled] = useState<Course[]>([]);
  const [favorites, setFavorites] = useState<Course[]>([]);

  const selectedCrns = useMemo(() => scheduled.map((c) => c.crn), [scheduled]);

  const totalCredits = useMemo(() => scheduled.reduce((acc, c) => acc + c.credits, 0), [scheduled]);

  const averageDifficulty = useMemo(() => {
    if (scheduled.length === 0) return null;
    const sum = scheduled.reduce((acc, c) => acc + c.difficulty, 0);
    return sum / scheduled.length;
  }, [scheduled]);

  const toggleSchedule = (course: Course) => {
    setScheduled((prev) => {
      const exists = prev.some((c) => c.id === course.id);
      return exists ? prev.filter((c) => c.id !== course.id) : [...prev, course];
    });
  };

  const toggleFavorite = (course: Course) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => c.id === course.id);
      return exists ? prev.filter((c) => c.id !== course.id) : [...prev, course];
    });
  };

  // When removing a course from schedule, keep InfoBox usable.
  const selectCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveLeftTab('info');
  };

  const lastUpdatedText = 'Demo data (connect backend next)';

  return (
    <div className="appShell">
      <TopNav
        appName={appName}
        semesterId={semesterId}
        semesters={semesters}
        semesterLabel={semesterLabel}
        lastUpdatedText={lastUpdatedText}
        onSemesterChange={setSemesterId}
      />

      <div className="mainContainer">
        <LeftInfoPanel
          activeTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
          selectedCourse={selectedCourse}
          selectedCrns={selectedCrns}
        />

        <ScheduleGrid
          courses={scheduled}
          onSelectCourse={selectCourse}
        />

        <RightSearchPanel
          allCourses={allCourses}
          scheduled={scheduled}
          favorites={favorites}
          onSelectCourse={selectCourse}
          onToggleSchedule={toggleSchedule}
          onToggleFavorite={toggleFavorite}
          averageDifficulty={averageDifficulty}
          totalCredits={totalCredits}
        />
      </div>
    </div>
  );
}
