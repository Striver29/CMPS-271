const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const BASE_URL = 'https://sturegss.aub.edu.lb/StudentRegistrationSsb';
const PAGE_SIZE = 500;

// Change these two values when you want a different term.
// You can also override them at runtime:
//   node courseFetcher_semester_based.cjs 202710 "Fall 2026-2027"
//   TERM_CODE=202710 TERM_LABEL="Fall 2026-2027" node courseFetcher_semester_based.cjs
const DEFAULT_TERM_CODE = '202710';
const DEFAULT_TERM_LABEL = 'Fall 2026-2027';

const TERM_CODE = process.argv[2] || process.env.TERM_CODE || DEFAULT_TERM_CODE;
const TERM_LABEL = process.argv[3] || process.env.TERM_LABEL || DEFAULT_TERM_LABEL;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function saveTermToDB() {
  const { error } = await supabase
    .from('terms')
    .upsert(
      {
        code: TERM_CODE,
        description: TERM_LABEL,
        is_current: true,
      },
      { onConflict: 'code' }
    );

  if (error) {
    console.error(`  Warning: term save error (${TERM_LABEL}): ${error.message}`);
  } else {
    console.log(`Saved term: ${TERM_LABEL} (${TERM_CODE})`);
  }
}

async function navigateToTerm(context) {
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.goto(
    `${BASE_URL}/ssb/term/termSelection?mode=search`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await page.waitForTimeout(2000);

  await page.evaluate((termValue) => {
    const select = document.querySelector('#txt_term');
    if (select) {
      select.value = termValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      const $select = window.$ ? window.$('#txt_term') : null;
      if ($select && $select.select2) {
        $select.select2('val', termValue);
      }
    }
  }, TERM_CODE);

  await page.waitForTimeout(1000);

  const [popup] = await Promise.all([
    new Promise((resolve) => {
      context.once('page', resolve);
      setTimeout(() => resolve(null), 2000);
    }),
    page.click('#term-go'),
  ]);

  let searchPage = page;
  if (popup) {
    searchPage = popup;
    await searchPage.waitForLoadState('domcontentloaded');
  } else {
    try {
      await page.waitForNavigation({ timeout: 3000 });
    } catch (_) {
      // Some Banner pages update in place instead of performing a full navigation.
    }
  }

  await searchPage.waitForTimeout(2000);
  return searchPage;
}

async function getAllSubjects(page) {
  const response = await page.evaluate(async (term) => {
    const res = await fetch(
      `/StudentRegistrationSsb/ssb/classSearch/get_subject?term=${term}&offset=1&max=500`,
      { headers: { Accept: 'application/json' } }
    );
    return res.json();
  }, TERM_CODE);

  if (!response || response.length === 0) {
    return [];
  }

  return response;
}

async function returnToSearchForm(searchPage) {
  const courseNumberVisible = await searchPage.isVisible('#txt_courseNumber');
  if (courseNumberVisible) {
    return;
  }

  await searchPage.click(
    '#search-again-button, button:has-text("Search Again"), a:has-text("Search Again")',
    { force: true, timeout: 10000 }
  );
  await searchPage.waitForTimeout(1000);
}

async function setSubject(searchPage, subjectCode) {
  await searchPage.evaluate((code) => {
    const input = document.querySelector('#txt_subject, input[name="txt_subject"]');
    if (input) {
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, subjectCode);
}

async function clearCourseNumber(searchPage) {
  await searchPage.fill('#txt_courseNumber', '');
  await searchPage.waitForTimeout(300);
  await searchPage.keyboard.press('Escape');
  await searchPage.waitForTimeout(200);
  await searchPage.click('body');
  await searchPage.waitForTimeout(200);
}

async function fetchRemainingSections(searchPage, subjectCode, totalCount, alreadyFetched) {
  return searchPage.evaluate(async ({ term, subject, pageSize, totalCount, alreadyFetched }) => {
    const results = [];
    let offset = alreadyFetched + 1;

    while (offset <= totalCount) {
      const res = await fetch(
        `/StudentRegistrationSsb/ssb/searchResults/searchResults?term=${term}&subject=${subject}&offset=${offset}&pageMaxSize=${pageSize}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();

      if (!data.data || data.data.length === 0) {
        break;
      }

      results.push(...data.data);
      offset += data.data.length;
    }

    return results;
  }, {
    term: TERM_CODE,
    subject: subjectCode,
    pageSize: PAGE_SIZE,
    totalCount,
    alreadyFetched,
  });
}

function buildCourseRows(sections) {
  const courses = [];

  for (const section of sections) {
    const instructors = (section.faculty || [])
      .map((faculty) => faculty.displayName)
      .join(', ') || 'TBA';

    const credits = section.creditHours
      ?? section.creditHourLow
      ?? section.creditHourHigh
      ?? null;

    if (credits == null) {
      console.warn(
        `  Warning: no credit info for CRN ${section.courseReferenceNumber} (${section.subject} ${section.courseNumber})`
      );
    }

    let days = 'TBA';
    let time = 'TBA';
    let location = 'TBA';

    const firstMeetingWithTime = (section.meetingsFaculty || [])
      .find((meeting) => meeting.meetingTime);

    if (firstMeetingWithTime?.meetingTime) {
      const meetingTime = firstMeetingWithTime.meetingTime;
      const activeDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        .filter((day) => meetingTime[day]);

      days = activeDays.join(', ') || 'TBA';
      time = meetingTime.beginTime && meetingTime.endTime
        ? `${meetingTime.beginTime} - ${meetingTime.endTime}`
        : 'TBA';
      location = `${meetingTime.building || ''} ${meetingTime.room || ''}`.trim() || 'TBA';
    }

    courses.push({
      crn: section.courseReferenceNumber,
      code: `${section.subject} ${section.courseNumber}`,
      courseNumber: section.courseNumber != null ? String(section.courseNumber).padStart(3, '0') : null,
      section: section.sequenceNumber,
      title: section.courseTitle,
      credits,
      instructors,
      days,
      time,
      location,
      seatsAvailable: section.seatsAvailable,
      maxEnrollment: section.maximumEnrollment,
      status: section.seatsAvailable > 0 ? 'Open' : 'Full',
      scheduleType: section.scheduleTypeDescription || 'N/A',
      subjectCode: section.subject,
      termCode: TERM_CODE,
      prerequisites: section.prerequisiteDescription ?? null,
      attributes: Array.isArray(section.sectionAttributes)
        ? section.sectionAttributes
          .map((attribute) => attribute.description ?? attribute.code ?? String(attribute))
          .filter(Boolean)
        : [],
      linkedCourses: section.isSectionLinked && section.linkedSection
        ? [String(section.linkedSection)]
        : [],
    });
  }

  const seen = new Map();
  for (const course of courses) {
    if (!seen.has(course.crn)) {
      seen.set(course.crn, course);
    }
  }

  return [...seen.values()];
}

async function fetchAllCoursesForSubject(searchPage, subjectCode) {
  try {
    await returnToSearchForm(searchPage);
    await searchPage.waitForSelector('#txt_courseNumber', { state: 'visible', timeout: 10000 });
    await setSubject(searchPage, subjectCode);
    await clearCourseNumber(searchPage);

    const [firstResponse] = await Promise.all([
      searchPage.waitForResponse(
        (resp) => resp.url().includes('searchResults') && resp.status() === 200,
        { timeout: 20000 }
      ),
      searchPage.click('#search-go', { force: true }),
    ]);

    const firstData = await firstResponse.json();
    const totalCount = firstData.totalCount || 0;
    if (totalCount === 0) {
      return [];
    }

    let allSections = [...(firstData.data || [])];

    if (totalCount > allSections.length) {
      const remainingSections = await fetchRemainingSections(
        searchPage,
        subjectCode,
        totalCount,
        allSections.length
      );
      allSections = [...allSections, ...remainingSections];
    }

    return buildCourseRows(allSections);
  } catch (err) {
    console.error(`  Warning: error fetching ${subjectCode}: ${err.message}`);
    return [];
  }
}

const professorCache = {};

async function getOrCreateProfessor(fullName) {
  if (fullName === 'TBA') {
    return null;
  }

  if (professorCache[fullName] !== undefined) {
    return professorCache[fullName];
  }

  const { data: existing } = await supabase
    .from('professors')
    .select('id')
    .eq('full_name', fullName)
    .single();

  if (existing) {
    professorCache[fullName] = existing.id;
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from('professors')
    .insert({ full_name: fullName })
    .select('id')
    .single();

  if (error) {
    console.error(`  Warning: professor error (${fullName}): ${error.message}`);
    professorCache[fullName] = null;
    return null;
  }

  professorCache[fullName] = inserted.id;
  return inserted.id;
}

async function saveCoursesToDB(courses) {
  let saved = 0;

  for (const course of courses) {
    try {
      const professorId = await getOrCreateProfessor(course.instructors);

      const { error } = await supabase
        .from('courses')
        .upsert(
          {
            crn: course.crn,
            title: course.title,
            department: course.subjectCode,
            course_number: course.courseNumber,
            section: course.section,
            credits: course.credits,
            schedule: {
              days: course.days,
              time: course.time,
              location: course.location,
              section: course.section,
              type: course.scheduleType,
            },
            professor_id: professorId,
            semester: course.termCode,
            capacity: course.maxEnrollment,
            enrolled_count: course.maxEnrollment - course.seatsAvailable,
            prerequisites: course.prerequisites,
            attributes: course.attributes,
            linked_courses: course.linkedCourses.map(String),
          },
          { onConflict: 'crn,semester' }
        );

      if (error) {
        console.error(`  Warning: course error (CRN ${course.crn}): ${error.message}`);
      } else {
        saved++;
      }
    } catch (err) {
      console.error(`  Warning: unexpected error for CRN ${course.crn}: ${err.message}`);
    }
  }

  return saved;
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`   AUB Fetcher - ${TERM_LABEL} (${TERM_CODE})`);
  console.log(`${'='.repeat(70)}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  let totalFetched = 0;
  let totalSaved = 0;

  try {
    await saveTermToDB();

    const searchPage = await navigateToTerm(context);
    const subjects = await getAllSubjects(searchPage);
    console.log(`${subjects.length} subjects found for ${TERM_LABEL}\n`);

    for (let index = 0; index < subjects.length; index++) {
      const { code, description } = subjects[index];
      process.stdout.write(`[${index + 1}/${subjects.length}] ${code} (${description})... `);

      const courses = await fetchAllCoursesForSubject(searchPage, code);

      if (courses.length === 0) {
        console.log('no courses.');
        continue;
      }

      const saved = await saveCoursesToDB(courses);
      totalFetched += courses.length;
      totalSaved += saved;
      console.log(`${courses.length} fetched, ${saved} saved.`);

      await searchPage.waitForTimeout(300);
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Done. ${totalFetched} fetched, ${totalSaved} saved to Supabase.`);
    console.log(`${'='.repeat(70)}\n`);
  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();