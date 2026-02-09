const { chromium } = require('playwright');
const readline = require('readline');

function question(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  console.log('=== AUB Course Search ===\n');
  const term = await question('Enter term code (e.g., 202620): ');
  const subject = await question('Enter subject code (e.g., CMPS): ');
  const courseNumber = await question('Enter course number (e.g., 271): ');
  
  console.log('\nSearching for courses...\n');
  
  const browser = await chromium.launch({
    headless: true, // Changed to headless since it's working
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });
  
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  });
  
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to base URL
    await page.goto('https://sturegss.aub.edu.lb/StudentRegistrationSsb/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    
    // Navigate to term selection
    await page.goto(
      'https://sturegss.aub.edu.lb/StudentRegistrationSsb/ssb/term/termSelection?mode=search',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(2000);
    
    // Set term directly
    await page.evaluate((termValue) => {
      const select = document.querySelector('#txt_term');
      if (select) {
        select.value = termValue;
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
        
        const $select = window.$ ? window.$('#txt_term') : null;
        if ($select && $select.select2) {
          $select.select2('val', termValue);
        }
      }
    }, term);
    
    await page.waitForTimeout(1000);
    
    // Click Continue
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
      try {
        await page.waitForNavigation({ timeout: 3000 });
      } catch (e) {
        // No navigation
      }
    }
    
    await searchPage.waitForTimeout(2000);
    
    // Fill subject - but don't click into Select2 dropdowns
    await searchPage.evaluate((subjectCode) => {
      // Find the subject input by looking for txt_subject
      const subjectInput = document.querySelector('#txt_subject, input[name="txt_subject"]');
      if (subjectInput) {
        subjectInput.value = subjectCode;
        subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, subject.toUpperCase());
    
    console.log(`✓ Filled subject: ${subject}`);
    
    // Fill course number
    await searchPage.fill('#txt_courseNumber', courseNumber);
    console.log(`✓ Filled course number: ${courseNumber}`);
    
    await searchPage.waitForTimeout(500);
    
    // Close any open Select2 dropdowns by pressing Escape
    await searchPage.keyboard.press('Escape');
    await searchPage.waitForTimeout(500);
    
    // Click away from any inputs to close dropdowns
    await searchPage.click('body');
    await searchPage.waitForTimeout(500);
    
    // Now click the search button
    console.log('\nClicking search button...');
    
    const [response] = await Promise.all([
      searchPage.waitForResponse(
        resp => {
          const url = resp.url();
          return url.includes('searchResults') && resp.status() === 200;
        },
        { timeout: 30000 }
      ),
      // Use force click to bypass the mask
      searchPage.click('#search-go', { force: true })
    ]);
    
    const data = await response.json();
    console.log('✓ Got search results!\n');
    
    // Parse results
    const courses = [];
    for (const c of data.data || []) {
      const instructors = (c.faculty || []).map(f => f.displayName);
      for (const m of c.meetingsFaculty || []) {
        const mt = m.meetingTime;
        if (!mt) continue;
        const days = ['monday','tuesday','wednesday','thursday','friday']
          .filter(d => mt[d]);
        courses.push({
          crn: c.courseReferenceNumber,
          code: `${c.subject} ${c.courseNumber}`,
          section: c.sequenceNumber,
          title: c.courseTitle,
          credits: c.creditHours,
          instructors: instructors.join(', ') || 'TBA',
          days: days.join(', ') || 'TBA',
          time: mt.beginTime && mt.endTime ? `${mt.beginTime} - ${mt.endTime}` : 'TBA',
          location: `${mt.building || ""} ${mt.room || ""}`.trim() || 'TBA',
          seatsAvailable: c.seatsAvailable,
          maxEnrollment: c.maximumEnrollment
        });
      }
    }
    
    // Display results
    if (courses.length === 0) {
      console.log('No courses found.\n');
    } else {
      console.log(`${'='.repeat(100)}`);
      console.log(`Found ${courses.length} section(s):`);
      console.log('='.repeat(100));
      
      courses.forEach((course, index) => {
        console.log(`\n[${index + 1}] ${course.code} - Section ${course.section} (CRN: ${course.crn})`);
        console.log(`    Title: ${course.title}`);
        console.log(`    Credits: ${course.credits}`);
        console.log(`    Instructor(s): ${course.instructors}`);
        console.log(`    Schedule: ${course.days} ${course.time}`);
        console.log(`    Location: ${course.location}`);
        console.log(`    Seats: ${course.seatsAvailable}/${course.maxEnrollment} available`);
      });
      
      console.log('\n' + '='.repeat(100) + '\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();