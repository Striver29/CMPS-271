import type { Course, Day, Meeting } from '../types.ts';

const DAY_NAME_MAP: Record<string, Day> = {
  m: 'M',
  mon: 'M',
  monday: 'M',
  t: 'T',
  tue: 'T',
  tues: 'T',
  tuesday: 'T',
  w: 'W',
  wed: 'W',
  wednesday: 'W',
  r: 'R',
  th: 'R',
  thu: 'R',
  thur: 'R',
  thurs: 'R',
  thursday: 'R',
  f: 'F',
  fri: 'F',
  friday: 'F',
  s: 'S',
  sat: 'S',
  saturday: 'S',
};

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeMeetingDay(token: string): Day | null {
  return DAY_NAME_MAP[String(token).trim().toLowerCase()] ?? null;
}

function parseMeetingDays(rawDays: unknown): Day[] {
  if (Array.isArray(rawDays)) {
    return rawDays
      .map((value) => normalizeMeetingDay(String(value)))
      .filter((value): value is Day => value !== null);
  }

  return String(rawDays ?? '')
    .split(/[\s,/|-]+/)
    .map((value) => normalizeMeetingDay(value))
    .filter((value): value is Day => value !== null);
}

function normalizeMilitaryTime(rawTime: unknown): string | null {
  const time = String(rawTime ?? '').trim();
  if (!time) return null;

  const hhmmMatch = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (hhmmMatch) {
    return `${hhmmMatch[1].padStart(2, '0')}:${hhmmMatch[2]}`;
  }

  const digits = time.replace(/\D/g, '');
  if (digits.length === 3) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  return null;
}

function parseScheduleMeeting(schedule: any): Meeting[] {
  const days = parseMeetingDays(schedule?.days);
  const rawTime = String(schedule?.time ?? '');
  const [rawStart = '', rawEnd = ''] = rawTime.split(/-|–|—/).map((value) => value.trim());
  const start = normalizeMilitaryTime(rawStart);
  const end = normalizeMilitaryTime(rawEnd);

  if (!days.length || !start || !end) {
    return [];
  }

  return [{
    days,
    start,
    end,
    location: String(schedule?.location ?? '').trim(),
    type: String(schedule?.type ?? 'Lecture').trim() || 'Lecture',
  }];
}

function getInstructorName(rawCourse: any): string {
  if (typeof rawCourse?.professors?.full_name === 'string' && rawCourse.professors.full_name.trim()) {
    return rawCourse.professors.full_name.trim();
  }

  if (Array.isArray(rawCourse?.professors)) {
    const instructor = rawCourse.professors.find(
      (entry: any) => typeof entry?.full_name === 'string' && entry.full_name.trim()
    );
    if (instructor) return instructor.full_name.trim();
  }

  return 'TBA';
}

export function mapApiCourseToCourse(rawCourse: any): Course {
  const department = String(rawCourse?.department ?? '').trim();
  const courseNumber = String(rawCourse?.course_number ?? '').trim();

  return {
    id: String(rawCourse?.id ?? `${department}-${courseNumber}-${rawCourse?.crn ?? 'section'}`),
    crn: String(rawCourse?.crn ?? ''),
    code: `${department} ${courseNumber}`.trim(),
    title: decodeHtml(String(rawCourse?.title ?? 'Untitled course')),
    instructor: getInstructorName(rawCourse),
    campus: String(rawCourse?.campus ?? 'Main Campus'),
    section: String(rawCourse?.schedule?.section ?? rawCourse?.section ?? ''),
    credits: Number(rawCourse?.credits ?? rawCourse?.creditHourHigh ?? rawCourse?.creditHourLow ?? 0),
    capacity: {
      enrolled: Number(rawCourse?.enrolled_count ?? 0),
      limit: Number(rawCourse?.capacity ?? 0),
    },
    attributes: Array.isArray(rawCourse?.attributes) ? rawCourse.attributes : [],
    prerequisites: rawCourse?.prerequisites ?? undefined,
    restrictions: rawCourse?.restrictions ?? undefined,
    difficulty: Number(rawCourse?.difficulty ?? 0),
    workload: Number(rawCourse?.workload ?? 0),
    meetings: parseScheduleMeeting(rawCourse?.schedule),
    isSectionLinked: Boolean(rawCourse?.is_section_linked ?? rawCourse?.isSectionLinked),
    linkIdentifier: rawCourse?.link_identifier ?? rawCourse?.linkIdentifier ?? null,
    scheduleType: rawCourse?.schedule?.type ?? rawCourse?.scheduleTypeDescription ?? undefined,
    subjectCourse: department && courseNumber ? `${department}${courseNumber}` : undefined,
  };
}

export function mapApiCoursesToCourses(rawCourses: any[]): Course[] {
  return Array.isArray(rawCourses) ? rawCourses.map(mapApiCourseToCourse) : [];
}
