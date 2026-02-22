//Should be final 
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const BASE_URL = 'https://sturegss.aub.edu.lb/StudentRegistrationSsb';
const PAGE_SIZE = 500;

// ─── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Fetch all terms (excluding clubs/online, 2025 onwards) ──────────────────
async function getAllTerms(page) {
  console.log('📅 Fetching all terms from AUB...');

  const terms = await page.evaluate(async () => {
    const res = await fetch(
      `/StudentRegistrationSsb/ssb/classSearch/getTerms?offset=1&max=50`,
      { headers: { 'Accept': 'application/json' } }
    );
    return res.json();
  });

  if (!terms || terms.length === 0) throw new Error('Could not fetch terms');

  const filtered = terms.filter(t =>
    !t.description.toLowerCase().includes('club') &&
    !t.description.toLowerCase().includes('online') &&
    /202[5-9]|20[3-9]\d/.test(t.description)
  );

  console.log(`✅ Found ${filtered.length} terms:`);
  filtered.forEach(t => console.log(`   • ${t.description} (${t.code})`));
  console.log();
  return filtered;
}

// ─── Save terms to DB (first term in list = most recent = current) ────────────
async function saveTermsToDB(terms) {
  console.log('💾 Saving terms to database...');

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const { error } = await supabase
      .from('terms')
      .upsert({
        code: term.code,
        description: term.description,
        is_current: i === 0  // first term is the most recent/current one
      }, { onConflict: 'code' });

    if (error) {
      console.error(`  ⚠ Term save error (${term.description}):`, error.message);
    } else {
      console.log(`  ✅ Saved term: ${term.description}${i === 0 ? ' (current)' : ''}`);
    }
  }
  console.log();
}

// ─── Navigate to the search page for a given term ────────────────────────────
async function navigateToTerm(context, termCode) {
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
      const $s = window.$ ? window.$('#txt_term') : null;
      if ($s && $s.select2) $s.select2('val', termValue);
    }
  }, termCode);

  await page.waitForTimeout(1000);

  const [popup] = await Promise.all([
    new Promise(resolve => {
      context.once('page', resolve);
      setTimeout(() => resolve(null), 2000);
    }),
    page.click('#term-go')
  ]);

  let searchPage = page;
  if (popup) {
    searchPage = popup;
    await searchPage.waitForLoadState('domcontentloaded');
  } else {
    try { await page.waitForNavigation({ timeout: 3000 }); } catch (_) {}
  }

  await searchPage.waitForTimeout(2000);
  return searchPage;
}

// ─── Fetch all subjects for a term ───────────────────────────────────────────
async function getAllSubjects(page, termCode) {
  const response = await page.evaluate(async (term) => {
    const res = await fetch(
      `/StudentRegistrationSsb/ssb/classSearch/get_subject?term=${term}&offset=1&max=500`,
      { headers: { 'Accept': 'application/json' } }
    );
    return res.json();
  }, termCode);

  if (!response || response.length === 0) return [];
  return response;
}

// ─── Fetch all courses for one subject (with pagination) ─────────────────────
async function fetchAllCoursesForSubject(searchPage, subjectCode, termCode) {
  try {
    const courseNumberVisible = await searchPage.isVisible('#txt_courseNumber');
    if (!courseNumberVisible) {
      await searchPage.click('#search-again-button, button:has-text("Search Again"), a:has-text("Search Again")', { force: true, timeout: 10000 });
      await searchPage.waitForTimeout(1000);
    }

    await searchPage.waitForSelector('#txt_courseNumber', { state: 'visible', timeout: 10000 });

    await searchPage.evaluate((code) => {
      const input = document.querySelector('#txt_subject, input[name="txt_subject"]');
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, subjectCode);

    await searchPage.fill('#txt_courseNumber', '');
    await searchPage.waitForTimeout(300);
    await searchPage.keyboard.press('Escape');
    await searchPage.waitForTimeout(200);
    await searchPage.click('body');
    await searchPage.waitForTimeout(200);

    const [firstResponse] = await Promise.all([
      searchPage.waitForResponse(
        resp => resp.url().includes('searchResults') && resp.status() === 200,
        { timeout: 20000 }
      ),
      searchPage.click('#search-go', { force: true })
    ]);

    const firstData = await firstResponse.json();
    const totalCount = firstData.totalCount || 0;
    if (totalCount === 0) return [];

    let allSections = [...(firstData.data || [])];

    if (totalCount > allSections.length) {
      const remainingData = await searchPage.evaluate(async ({ term, subject, pageSize, totalCount, alreadyFetched }) => {
        const results = [];
        let offset = alreadyFetched + 1;
        while (offset <= totalCount) {
          const res = await fetch(
            `/StudentRegistrationSsb/ssb/searchResults/searchResults?term=${term}&subject=${subject}&offset=${offset}&pageMaxSize=${pageSize}`,
            { headers: { 'Accept': 'application/json' } }
          );
          const data = await res.json();
          if (!data.data || data.data.length === 0) break;
          results.push(...data.data);
          offset += data.data.length;
        }
        return results;
      }, { term: termCode, subject: subjectCode, pageSize: PAGE_SIZE, totalCount, alreadyFetched: allSections.length });

      allSections = [...allSections, ...remainingData];
    }

    const courses = [];
    for (const c of allSections) {
      const instructors = (c.faculty || []).map(f => f.displayName).join(', ') || 'TBA';
      for (const m of c.meetingsFaculty || []) {
        const mt = m.meetingTime;
        if (!mt) continue;
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].filter(d => mt[d]);
        courses.push({
          crn: c.courseReferenceNumber,
          code: `${c.subject} ${c.courseNumber}`,
          section: c.sequenceNumber,
          title: c.courseTitle,
          credits: c.creditHours,
          instructors,
          days: days.join(', ') || 'TBA',
          time: mt.beginTime && mt.endTime ? `${mt.beginTime} - ${mt.endTime}` : 'TBA',
          location: `${mt.building || ''} ${mt.room || ''}`.trim() || 'TBA',
          seatsAvailable: c.seatsAvailable,
          maxEnrollment: c.maximumEnrollment,
          status: c.seatsAvailable > 0 ? 'Open' : 'Full',
          scheduleType: c.scheduleTypeDescription || 'N/A',
          subjectCode: c.subject,
          termCode
        });
      }
    }

    return courses;
  } catch (err) {
    console.error(`  ⚠ Error fetching ${subjectCode}:`, err.message);
    return [];
  }
}

// ─── Professor cache to avoid redundant DB calls ─────────────────────────────
const professorCache = {};

async function getOrCreateProfessor(fullName) {
  if (fullName === 'TBA') return null;

  // Return from cache if already processed
  if (professorCache[fullName] !== undefined) return professorCache[fullName];

  // Try to find existing professor first
  const { data: existing } = await supabase
    .from('professors')
    .select('id')
    .eq('full_name', fullName)
    .single();

  if (existing) {
    professorCache[fullName] = existing.id;
    return existing.id;
  }

  // Insert new professor
  const { data: inserted, error } = await supabase
    .from('professors')
    .insert({ full_name: fullName })
    .select('id')
    .single();

  if (error) {
    console.error(`  ⚠ Professor error (${fullName}):`, error.message);
    professorCache[fullName] = null;
    return null;
  }

  professorCache[fullName] = inserted.id;
  return inserted.id;
}

// ─── Save courses to Supabase ─────────────────────────────────────────────────
async function saveCoursesToDB(courses) {
  let saved = 0;

  for (const course of courses) {
    try {
      const professorId = await getOrCreateProfessor(course.instructors);

      const { error: courseError } = await supabase
        .from('courses')
        .upsert({
          crn: course.crn,
          title: course.title,
          department: course.subjectCode,
          credits: course.credits,
          schedule: {
            days: course.days,
            time: course.time,
            location: course.location,
            section: course.section,
            type: course.scheduleType
          },
          professor_id: professorId,
          semester: course.termCode,
          capacity: course.maxEnrollment,
          enrolled_count: course.maxEnrollment - course.seatsAvailable
        }, { onConflict: 'crn' });

      if (courseError) {
        console.error(`  ⚠ Course error (CRN ${course.crn}):`, courseError.message);
      } else {
        saved++;
      }
    } catch (err) {
      console.error(`  ⚠ Unexpected error for CRN ${course.crn}:`, err.message);
    }
  }

  return saved;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`   AUB Course Fetcher — Saving to Supabase`);
  console.log(`${'='.repeat(90)}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  const tempPage = await context.newPage();
  await tempPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await tempPage.waitForTimeout(2000);

  let grandTotal = 0;
  let grandSaved = 0;

  try {
    const terms = await getAllTerms(tempPage);
    await tempPage.close();

    // Save terms to DB first
    await saveTermsToDB(terms);

    for (const term of terms) {
      console.log(`\n${'█'.repeat(90)}`);
      console.log(`  TERM: ${term.description} (${term.code})`);
      console.log(`${'█'.repeat(90)}\n`);

      const searchPage = await navigateToTerm(context, term.code);
      const subjects = await getAllSubjects(searchPage, term.code);
      console.log(`📋 ${subjects.length} subjects found\n`);

      let termTotal = 0;
      let termSaved = 0;

      for (let i = 0; i < subjects.length; i++) {
        const { code, description } = subjects[i];
        process.stdout.write(`  [${i + 1}/${subjects.length}] ${code} (${description})... `);

        const courses = await fetchAllCoursesForSubject(searchPage, code, term.code);

        if (courses.length === 0) {
          console.log('no courses.');
          continue;
        }

        const saved = await saveCoursesToDB(courses);
        termTotal += courses.length;
        termSaved += saved;
        console.log(`${courses.length} fetched, ${saved} saved to DB.`);

        await searchPage.waitForTimeout(400);
      }

      console.log(`\n  ✅ Term total: ${termTotal} fetched, ${termSaved} saved`);
      grandTotal += termTotal;
      grandSaved += termSaved;
      await searchPage.close();
    }

    console.log(`\n${'='.repeat(90)}`);
    console.log(`✅ ALL DONE! ${grandTotal} courses fetched, ${grandSaved} saved to Supabase`);
    console.log(`${'='.repeat(90)}\n`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  } finally {
    await browser.close();
  }
})();























// // const { chromium } = require('playwright');
// // const readline = require('readline');
// // const { supabase } = require('./supabaseClient')

// // function question(prompt) {
// //   const rl = readline.createInterface({
// //     input: process.stdin,
// //     output: process.stdout
// //   });
  
// //   return new Promise((resolve) => {
// //     rl.question(prompt, (answer) => {
// //       rl.close();
// //       resolve(answer);
// //     });
// //   });
// // }

// // (async () => {
// //   console.log('=== AUB Course Search ===\n');
// //   const term = await question('Enter term code (e.g., 202620): ');
// //   const subject = await question('Enter subject code (e.g., CMPS): ');
// //   const courseNumber = await question('Enter course number (e.g., 271): ');
  
// //   console.log('\nSearching for courses...\n');
  
// //   const browser = await chromium.launch({
// //     headless: true, // Changed to headless since it's working
// //     args: [
// //       '--disable-blink-features=AutomationControlled',
// //       '--disable-dev-shm-usage',
// //       '--no-sandbox'
// //     ]
// //   });
  
// //   const context = await browser.newContext({
// //     userAgent:
// //       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
// //       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
// //     extraHTTPHeaders: {
// //       'Accept-Language': 'en-US,en;q=0.9',
// //       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
// //     }
// //   });
  
// //   await context.addInitScript(() => {
// //     Object.defineProperty(navigator, 'webdriver', {
// //       get: () => false,
// //     });
// //     window.navigator.chrome = { runtime: {} };
// //     Object.defineProperty(navigator, 'plugins', {
// //       get: () => [1, 2, 3, 4, 5],
// //     });
// //   });
  
// //   const page = await context.newPage();
  
// //   try {
// //     // Navigate to base URL
// //     await page.goto('https://sturegss.aub.edu.lb/StudentRegistrationSsb/', {
// //       waitUntil: 'domcontentloaded',
// //       timeout: 30000
// //     });
// //     await page.waitForTimeout(2000);
    
// //     // Navigate to term selection
// //     await page.goto(
// //       'https://sturegss.aub.edu.lb/StudentRegistrationSsb/ssb/term/termSelection?mode=search',
// //       { waitUntil: 'domcontentloaded', timeout: 30000 }
// //     );
// //     await page.waitForTimeout(2000);
    
// //     // Set term directly
// //     await page.evaluate((termValue) => {
// //       const select = document.querySelector('#txt_term');
// //       if (select) {
// //         select.value = termValue;
// //         const event = new Event('change', { bubbles: true });
// //         select.dispatchEvent(event);
        
// //         const $select = window.$ ? window.$('#txt_term') : null;
// //         if ($select && $select.select2) {
// //           $select.select2('val', termValue);
// //         }
// //       }
// //     }, term);
    
// //     await page.waitForTimeout(1000);
    
// //     // Click Continue
// //     const [popup] = await Promise.all([
// //       new Promise(resolve => {
// //         context.once('page', resolve);
// //         setTimeout(() => resolve(null), 2000);
// //       }),
// //       page.click('#term-go')
// //     ]);
    
// //     let searchPage = page;
// //     if (popup) {
// //       searchPage = popup;
// //       await searchPage.waitForLoadState('domcontentloaded');
// //     } else {
// //       try {
// //         await page.waitForNavigation({ timeout: 3000 });
// //       } catch (e) {
// //         // No navigation
// //       }
// //     }
    
// //     await searchPage.waitForTimeout(2000);
    
// //     // Fill subject - but don't click into Select2 dropdowns
// //     await searchPage.evaluate((subjectCode) => {
// //       // Find the subject input by looking for txt_subject
// //       const subjectInput = document.querySelector('#txt_subject, input[name="txt_subject"]');
// //       if (subjectInput) {
// //         subjectInput.value = subjectCode;
// //         subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
// //         subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
// //       }
// //     }, subject.toUpperCase());
    
// //     console.log(`✓ Filled subject: ${subject}`);
    
// //     // Fill course number
// //     await searchPage.fill('#txt_courseNumber', courseNumber);
// //     console.log(`✓ Filled course number: ${courseNumber}`);
    
// //     await searchPage.waitForTimeout(500);
    
// //     // Close any open Select2 dropdowns by pressing Escape
// //     await searchPage.keyboard.press('Escape');
// //     await searchPage.waitForTimeout(500);
    
// //     // Click away from any inputs to close dropdowns
// //     await searchPage.click('body');
// //     await searchPage.waitForTimeout(500);
    
// //     // Now click the search button
// //     console.log('\nClicking search button...');
    
// //     const [response] = await Promise.all([
// //       searchPage.waitForResponse(
// //         resp => {
// //           const url = resp.url();
// //           return url.includes('searchResults') && resp.status() === 200;
// //         },
// //         { timeout: 30000 }
// //       ),
// //       // Use force click to bypass the mask
// //       searchPage.click('#search-go', { force: true })
// //     ]);
    
// //     const data = await response.json();
// //     console.log('✓ Got search results!\n');
    
// //     // Parse results
// //     const courses = [];
// //     for (const c of data.data || []) {
// //       const instructors = (c.faculty || []).map(f => f.displayName);
// //       for (const m of c.meetingsFaculty || []) {
// //         const mt = m.meetingTime;
// //         if (!mt) continue;
// //         const days = ['monday','tuesday','wednesday','thursday','friday']
// //           .filter(d => mt[d]);
// //         courses.push({
// //           crn: c.courseReferenceNumber,
// //           code: `${c.subject} ${c.courseNumber}`,
// //           section: c.sequenceNumber,
// //           title: c.courseTitle,
// //           credits: c.creditHours,
// //           instructors: instructors.join(', ') || 'TBA',
// //           days: days.join(', ') || 'TBA',
// //           time: mt.beginTime && mt.endTime ? `${mt.beginTime} - ${mt.endTime}` : 'TBA',
// //           location: `${mt.building || ""} ${mt.room || ""}`.trim() || 'TBA',
// //           seatsAvailable: c.seatsAvailable,
// //           maxEnrollment: c.maximumEnrollment
// //         });
// //       }
// //     }
    
// //     // Display results
// //     if (courses.length === 0) {
// //       console.log('No courses found.\n');
// //     } else {
// //       console.log(`${'='.repeat(100)}`);
// //       console.log(`Found ${courses.length} section(s):`);
// //       console.log('='.repeat(100));
      
// //       courses.forEach((course, index) => {
// //         console.log(`\n[${index + 1}] ${course.code} - Section ${course.section} (CRN: ${course.crn})`);
// //         console.log(`    Title: ${course.title}`);
// //         console.log(`    Credits: ${course.credits}`);
// //         console.log(`    Instructor(s): ${course.instructors}`);
// //         console.log(`    Schedule: ${course.days} ${course.time}`);
// //         console.log(`    Location: ${course.location}`);
// //         console.log(`    Seats: ${course.seatsAvailable}/${course.maxEnrollment} available`);
// //       });
      
// //       console.log('\n' + '='.repeat(100) + '\n');
// //     }
    
// //   } catch (error) {
// //     console.error('\n❌ Error:', error.message);
// //   } finally {
// //     await browser.close();
// //   }
// // })();


// const { chromium } = require('playwright');
// require('dotenv').config();

// const BASE_URL = 'https://sturegss.aub.edu.lb/StudentRegistrationSsb';
// const PAGE_SIZE = 500;

// // ─── Fetch all terms (excluding clubs) ───────────────────────────────────────
// async function getAllTerms(page) {
//   console.log('📅 Fetching all terms from AUB...');

//   const terms = await page.evaluate(async () => {
//     const res = await fetch(
//       `/StudentRegistrationSsb/ssb/classSearch/getTerms?offset=1&max=50`,
//       { headers: { 'Accept': 'application/json' } }
//     );
//     return res.json();
//   });

//   if (!terms || terms.length === 0) throw new Error('Could not fetch terms');

//   // Filter out clubs and only keep terms from 2025 onwards
//   const filtered = terms.filter(t =>
//     !t.description.toLowerCase().includes('club') &&
//     /202[5-9]|20[3-9]\d/.test(t.description)
//   );
//   console.log(`✅ Found ${filtered.length} terms (clubs excluded):`);
//   filtered.forEach(t => console.log(`   • ${t.description} (${t.code})`));
//   console.log();
//   return filtered;
// }

// // ─── Navigate to the search page for a given term ────────────────────────────
// async function navigateToTerm(context, termCode) {
//   const page = await context.newPage();

//   await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
//   await page.waitForTimeout(2000);

//   await page.goto(
//     `${BASE_URL}/ssb/term/termSelection?mode=search`,
//     { waitUntil: 'domcontentloaded', timeout: 30000 }
//   );
//   await page.waitForTimeout(2000);

//   await page.evaluate((termValue) => {
//     const select = document.querySelector('#txt_term');
//     if (select) {
//       select.value = termValue;
//       select.dispatchEvent(new Event('change', { bubbles: true }));
//       const $s = window.$ ? window.$('#txt_term') : null;
//       if ($s && $s.select2) $s.select2('val', termValue);
//     }
//   }, termCode);

//   await page.waitForTimeout(1000);

//   const [popup] = await Promise.all([
//     new Promise(resolve => {
//       context.once('page', resolve);
//       setTimeout(() => resolve(null), 2000);
//     }),
//     page.click('#term-go')
//   ]);

//   let searchPage = page;
//   if (popup) {
//     searchPage = popup;
//     await searchPage.waitForLoadState('domcontentloaded');
//   } else {
//     try { await page.waitForNavigation({ timeout: 3000 }); } catch (_) {}
//   }

//   await searchPage.waitForTimeout(2000);
//   return searchPage;
// }

// // ─── Fetch all subjects for a term ───────────────────────────────────────────
// async function getAllSubjects(page, termCode) {
//   const response = await page.evaluate(async (term) => {
//     const res = await fetch(
//       `/StudentRegistrationSsb/ssb/classSearch/get_subject?term=${term}&offset=1&max=500`,
//       { headers: { 'Accept': 'application/json' } }
//     );
//     return res.json();
//   }, termCode);

//   if (!response || response.length === 0) return [];
//   return response;
// }

// // ─── Fetch all courses for one subject (with pagination) ─────────────────────
// async function fetchAllCoursesForSubject(searchPage, subjectCode, termCode) {
//   try {
//     // Go back to search form if we're on results page
//     const courseNumberVisible = await searchPage.isVisible('#txt_courseNumber');
//     if (!courseNumberVisible) {
//       await searchPage.click('#search-again-button, button:has-text("Search Again"), a:has-text("Search Again")', { force: true, timeout: 10000 });
//       await searchPage.waitForTimeout(1000);
//     }

//     await searchPage.waitForSelector('#txt_courseNumber', { state: 'visible', timeout: 10000 });

//     // Set subject
//     await searchPage.evaluate((code) => {
//       const input = document.querySelector('#txt_subject, input[name="txt_subject"]');
//       if (input) {
//         input.value = code;
//         input.dispatchEvent(new Event('input', { bubbles: true }));
//         input.dispatchEvent(new Event('change', { bubbles: true }));
//       }
//     }, subjectCode);

//     await searchPage.fill('#txt_courseNumber', '');
//     await searchPage.waitForTimeout(300);
//     await searchPage.keyboard.press('Escape');
//     await searchPage.waitForTimeout(200);
//     await searchPage.click('body');
//     await searchPage.waitForTimeout(200);

//     // Trigger search
//     const [firstResponse] = await Promise.all([
//       searchPage.waitForResponse(
//         resp => resp.url().includes('searchResults') && resp.status() === 200,
//         { timeout: 20000 }
//       ),
//       searchPage.click('#search-go', { force: true })
//     ]);

//     const firstData = await firstResponse.json();
//     const totalCount = firstData.totalCount || 0;
//     if (totalCount === 0) return [];

//     let allSections = [...(firstData.data || [])];

//     // Fetch remaining pages if needed
//     if (totalCount > allSections.length) {
//       const remainingData = await searchPage.evaluate(async ({ term, subject, pageSize, totalCount, alreadyFetched }) => {
//         const results = [];
//         let offset = alreadyFetched + 1;
//         while (offset <= totalCount) {
//           const res = await fetch(
//             `/StudentRegistrationSsb/ssb/searchResults/searchResults?term=${term}&subject=${subject}&offset=${offset}&pageMaxSize=${pageSize}`,
//             { headers: { 'Accept': 'application/json' } }
//           );
//           const data = await res.json();
//           if (!data.data || data.data.length === 0) break;
//           results.push(...data.data);
//           offset += data.data.length;
//         }
//         return results;
//       }, { term: termCode, subject: subjectCode, pageSize: PAGE_SIZE, totalCount, alreadyFetched: allSections.length });

//       allSections = [...allSections, ...remainingData];
//     }

//     // Parse
//     const courses = [];
//     for (const c of allSections) {
//       const instructors = (c.faculty || []).map(f => f.displayName).join(', ') || 'TBA';
//       for (const m of c.meetingsFaculty || []) {
//         const mt = m.meetingTime;
//         if (!mt) continue;
//         const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].filter(d => mt[d]);
//         courses.push({
//           crn: c.courseReferenceNumber,
//           code: `${c.subject} ${c.courseNumber}`,
//           section: c.sequenceNumber,
//           title: c.courseTitle,
//           credits: c.creditHours,
//           instructors,
//           days: days.join(', ') || 'TBA',
//           time: mt.beginTime && mt.endTime ? `${mt.beginTime} - ${mt.endTime}` : 'TBA',
//           location: `${mt.building || ''} ${mt.room || ''}`.trim() || 'TBA',
//           seatsAvailable: c.seatsAvailable,
//           maxEnrollment: c.maximumEnrollment,
//           status: c.seatsAvailable > 0 ? 'Open' : 'Full',
//           scheduleType: c.scheduleTypeDescription || 'N/A'
//         });
//       }
//     }

//     return courses;
//   } catch (err) {
//     console.error(`  ⚠ Error fetching ${subjectCode}:`, err.message);
//     return [];
//   }
// }

// // ─── Display courses ──────────────────────────────────────────────────────────
// function displayCourses(courses, label) {
//   console.log(`\n${'─'.repeat(90)}`);
//   console.log(`  ${label} — ${courses.length} section(s)`);
//   console.log(`${'─'.repeat(90)}`);
//   courses.forEach((course, i) => {
//     console.log(`\n  [${i + 1}] ${course.code} - Section ${course.section} (CRN: ${course.crn})`);
//     console.log(`      Title:      ${course.title}`);
//     console.log(`      Credits:    ${course.credits}`);
//     console.log(`      Instructor: ${course.instructors}`);
//     console.log(`      Schedule:   ${course.days} ${course.time}`);
//     console.log(`      Location:   ${course.location}`);
//     console.log(`      Type:       ${course.scheduleType}`);
//     console.log(`      Seats:      ${course.seatsAvailable}/${course.maxEnrollment} (${course.status})`);
//   });
// }

// // ─── Main ─────────────────────────────────────────────────────────────────────
// (async () => {
//   console.log(`\n${'='.repeat(90)}`);
//   console.log(`   AUB Course Fetcher — TEST MODE (no database)`);
//   console.log(`${'='.repeat(90)}\n`);

//   const browser = await chromium.launch({
//     headless: true,
//     args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox']
//   });

//   const context = await browser.newContext({
//     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     extraHTTPHeaders: {
//       'Accept-Language': 'en-US,en;q=0.9',
//       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
//     }
//   });

//   await context.addInitScript(() => {
//     Object.defineProperty(navigator, 'webdriver', { get: () => false });
//     window.navigator.chrome = { runtime: {} };
//     Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
//   });

//   // Use a temp page just to fetch terms
//   const tempPage = await context.newPage();
//   await tempPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
//   await tempPage.waitForTimeout(2000);

//   let grandTotal = 0;

//   try {
//     const terms = await getAllTerms(tempPage);
//     await tempPage.close();

//     for (const term of terms) {
//       console.log(`\n${'█'.repeat(90)}`);
//       console.log(`  TERM: ${term.description} (${term.code})`);
//       console.log(`${'█'.repeat(90)}\n`);

//       // Open a fresh page for each term
//       const searchPage = await navigateToTerm(context, term.code);
//       const subjects = await getAllSubjects(searchPage, term.code);
//       console.log(`📋 ${subjects.length} subjects found for ${term.description}\n`);

//       let termTotal = 0;

//       for (let i = 0; i < subjects.length; i++) {
//         const { code, description } = subjects[i];
//         process.stdout.write(`  [${i + 1}/${subjects.length}] ${code} (${description})... `);

//         const courses = await fetchAllCoursesForSubject(searchPage, code, term.code);

//         if (courses.length === 0) {
//           console.log('no courses.');
//           continue;
//         }

//         console.log(`${courses.length} sections found.`);
//         displayCourses(courses, `${code} — ${description}`);
//         termTotal += courses.length;
//         await searchPage.waitForTimeout(400);
//       }

//       console.log(`\n  ✅ Term total: ${termTotal} sections`);
//       grandTotal += termTotal;
//       await searchPage.close();
//     }

//     console.log(`\n${'='.repeat(90)}`);
//     console.log(`✅ ALL DONE! Grand total: ${grandTotal} sections across all terms`);
//     console.log(`${'='.repeat(90)}\n`);

//   } catch (error) {
//     console.error('\n❌ Fatal error:', error.message);
//   } finally {
//     await browser.close();
//   }
// })();






















