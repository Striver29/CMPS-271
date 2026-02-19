import { useMemo, useState } from 'react';
import './App.css';
import type { Course } from './types';
import { COURSES, SEMESTERS } from './mockData';
import { TopNav } from './components/TopNav';
import { LeftInfoPanel } from './components/LeftInfoPanel';
import { ScheduleGrid } from './components/ScheduleGrid';
import { RightSearchPanel } from './components/RightSearchPanel';

export default function App() {
  const appName = 'AUB Course Planner';

  const [semesterId, setSemesterId] = useState(SEMESTERS[0]!.id);
  const semesterLabel = useMemo(
    () => SEMESTERS.find((s) => s.id === semesterId)?.label ?? 'Semester',
    [semesterId]
  );

  const [activeLeftTab, setActiveLeftTab] = useState<'welcome' | 'info' | 'crn'>('info');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(COURSES[0] ?? null);

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
        semesters={SEMESTERS}
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
          allCourses={COURSES}
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
