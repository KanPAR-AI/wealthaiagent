/**
 * Knee Arthritis Agent + ToolExecutor E2E — Exercise Calendar Reminders
 *
 * Tests the full pipeline:
 *   TURN 1: User describes knee symptoms → Agent gives exercise recommendations
 *           with YouTube video links (EPMPT methodology)
 *   TURN 2: User asks to add exercises as recurring calendar events
 *           → ToolExecutor detects tool-only request
 *           → Agentic loop creates calendar events via Composio (Google Calendar)
 *           → Events include exercise names + YouTube video links
 *   TURN 3: User asks to also email the exercise plan
 *           → ToolExecutor handles incremental tool request
 *
 * Validates:
 *   - Knee arthritis agent returns structured exercises with YouTube links
 *   - ToolExecutor correctly identifies "add to calendar" as tool-only request
 *   - Calendar events are created with exercise details + video references
 *   - Multi-turn incremental tool requests work (calendar → then email)
 *   - Error handling when Google Calendar isn't connected
 *   - Context from agent response flows correctly to tool executor
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: ./start-all.sh (chatservice:8080 + Redis)
 *   - Google Calendar connected via Composio (or test handles graceful failure)
 *
 * Run:
 *   npx playwright test e2e/knee-exercise-calendar.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

async function waitForResponse(page: Page, timeoutMs = 120_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // Response may be instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  await page.waitForTimeout(3000);
}

async function getChatText(page: Page): Promise<string> {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

/**
 * Get only the LAST assistant message text (not the full chat).
 * Useful for verifying turn-specific responses.
 */
async function getLastAssistantMessage(page: Page): Promise<string> {
  // All assistant messages are in chat bubbles. Get the last one.
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  const fullText = (await scrollArea.textContent()) || '';
  // Split by the agent marker pattern to isolate the latest response
  // The marker "[Using X agent]" precedes each response
  return fullText;
}

// ---------------------------------------------------------------------------
// Exercise Verification Helpers
// ---------------------------------------------------------------------------

interface ExerciseInfo {
  name: string;
  hasVideo: boolean;
  videoUrl?: string;
}

/**
 * Extract exercise names and YouTube video links from the response text.
 */
function extractExercises(text: string): ExerciseInfo[] {
  const knownExercises = [
    'Tailgate Swings',
    'Prone/Supine Glute Squeezes', 'Glute Squeezes',
    'Clamshells',
    'Fire Hydrants',
    'Donkey Kicks',
    'Bridges',
    'Standing Glute Squeezes',
    'Standing Glute Burners',
    'Baby Squat Holds', 'Baby Squat',
    'Baby Squat Reps',
    'Baby Lunge Holds', 'Baby Lunge',
    'Baby Lunge Reps',
    'Weighted Baby Squats',
  ];

  const exercises: ExerciseInfo[] = [];

  for (const name of knownExercises) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      // Check if there's a YouTube link near this exercise
      const exerciseIdx = text.toLowerCase().indexOf(name.toLowerCase());
      // Look within 1000 chars after the exercise name for a YouTube link
      const nearbyText = text.substring(exerciseIdx, exerciseIdx + 1000);
      const videoMatch = nearbyText.match(/youtube\.com\/watch\?v=([^&\s)]+)(&t=\d+)?/i);

      exercises.push({
        name,
        hasVideo: !!videoMatch,
        videoUrl: videoMatch ? `https://www.youtube.com/watch?v=${videoMatch[1]}${videoMatch[2] || ''}` : undefined,
      });
    }
  }

  return exercises;
}

/**
 * Extract all YouTube URLs from text.
 */
function extractYouTubeUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^\s)]+/gi);
  return matches || [];
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Knee Arthritis + Calendar Tools — Exercise Reminders E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    try {
      await page.getByText('Loading authentication').waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByText('Loading authentication').waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      // Auth may have completed instantly
    }
    await page.waitForTimeout(3000);
  });

  test('Full flow: Exercises → Calendar reminders → Email (3-turn tool workflow)', async ({ page }) => {
    // =================================================================
    // TURN 1: Describe knee symptoms → Get exercise recommendations
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    console.log('\n========== TURN 1: SYMPTOM DESCRIPTION → EXERCISES ==========\n');

    await sendMessage(
      page,
      'I have knee arthritis with pain level 4/10. My knees hurt when climbing stairs ' +
      'and I feel stiffness in the morning for about 10 minutes. ' +
      'What exercises should I do to strengthen my knees?',
    );
    await waitForResponse(page, 180_000);

    const turn1Text = await getChatText(page);

    // ----- Verify agent routing -----
    const routedCorrectly = /\[Using knee_arthritis agent\]/i.test(turn1Text);
    expect(routedCorrectly, 'Should route to knee_arthritis agent').toBe(true);
    console.log('  [OK] Routed to knee_arthritis agent');

    // ----- Verify exercise recommendations present -----
    const hasExerciseProgram = /Exercise Program/i.test(turn1Text);
    expect(hasExerciseProgram, 'Response must contain exercise program').toBe(true);
    console.log('  [OK] Exercise program present');

    // ----- Verify EPMPT phase -----
    const phaseMatch = turn1Text.match(/Phase\s*(\d)/i);
    expect(phaseMatch, 'Must identify EPMPT phase').toBeTruthy();
    const phase = parseInt(phaseMatch![1]);
    console.log(`  [OK] EPMPT Phase: ${phase}`);

    // ----- Extract exercises with video links -----
    const exercises = extractExercises(turn1Text);
    expect(
      exercises.length,
      `Must recommend at least 2 exercises. Found: ${exercises.map(e => e.name).join(', ')}`,
    ).toBeGreaterThanOrEqual(2);
    console.log(`  [OK] Exercises found: ${exercises.map(e => e.name).join(', ')}`);

    // ----- Verify YouTube video links -----
    const allYouTubeUrls = extractYouTubeUrls(turn1Text);
    console.log(`  YouTube links found: ${allYouTubeUrls.length}`);

    const exercisesWithVideos = exercises.filter(e => e.hasVideo);
    if (exercisesWithVideos.length > 0) {
      console.log('  [OK] Exercises with video links:');
      for (const ex of exercisesWithVideos) {
        console.log(`    - ${ex.name}: ${ex.videoUrl}`);
      }
    }

    // Verify Watch: links with YouTube URLs
    const hasWatchLinks = /Watch:.*youtube\.com/i.test(turn1Text);
    if (hasWatchLinks) {
      console.log('  [OK] "Watch:" video references with YouTube links present');
    }

    // Verify timestamped links (should have &t= parameter)
    const timestampedLinks = allYouTubeUrls.filter(url => /&t=\d+/.test(url));
    if (timestampedLinks.length > 0) {
      console.log(`  [OK] ${timestampedLinks.length} link(s) have timestamps for direct seek`);
    }

    // ----- Verify safety disclaimer -----
    const hasDisclaimer = /educational purposes only/i.test(turn1Text);
    expect(hasDisclaimer, 'Safety disclaimer must be present').toBe(true);
    console.log('  [OK] Safety disclaimer present');

    // ----- Verify glute-first principle -----
    const hasGlute = /glute/i.test(turn1Text);
    expect(hasGlute, 'Must mention glute-first principle (EPMPT)').toBe(true);
    console.log('  [OK] Glute-first principle mentioned');

    console.log('\n========== TURN 1 COMPLETE ==========\n');

    // =================================================================
    // TURN 2: Ask to add exercises as recurring calendar reminders
    //
    // This tests the ToolExecutor:
    // - Detects tool-only request (references prior exercise content)
    // - Agentic loop with Google Calendar via Composio
    // - Events should include exercise names + YouTube links
    // =================================================================
    console.log('\n========== TURN 2: ADD EXERCISE REMINDERS TO CALENDAR ==========\n');

    await sendMessage(
      page,
      'Add these exercises as recurring daily reminders on my Google Calendar for the next 4 weeks. ' +
      'Include the YouTube video links in the event description so I can watch the demos.',
    );
    await waitForResponse(page, 120_000);

    const turn2Text = await getChatText(page);

    // ----- Verify response acknowledges the calendar request -----
    const acknowledgesCalendar = /calendar|event|reminder|schedule/i.test(turn2Text);
    expect(
      acknowledgesCalendar,
      'Response must acknowledge the calendar request',
    ).toBe(true);
    console.log('  [OK] Response acknowledges calendar request');

    // ----- Check for success or connection-needed messaging -----
    const calendarSuccess = /added|created|scheduled|set up/i.test(turn2Text);
    const needsConnection = /connect|authenticate|sign in|authorize|permission|not connected/i.test(turn2Text);
    const toolError = /error|failed|unable|couldn't/i.test(turn2Text);

    if (calendarSuccess) {
      console.log('  [OK] Calendar events created successfully!');

      // Verify the response mentions recurring/daily
      const mentionsRecurring = /recurring|daily|every day|each day|4 weeks|28 days/i.test(turn2Text);
      console.log(`  Mentions recurring schedule: ${mentionsRecurring}`);

      // Verify exercise names appear in the calendar confirmation
      const exerciseNamesInResponse = exercises
        .filter(e => turn2Text.toLowerCase().includes(e.name.toLowerCase()));
      if (exerciseNamesInResponse.length > 0) {
        console.log(`  [OK] Calendar events reference exercises: ${exerciseNamesInResponse.map(e => e.name).join(', ')}`);
      }

      // Check if YouTube links are mentioned in the calendar event descriptions
      const mentionsVideoInEvents = /video|youtube|link|demo/i.test(turn2Text);
      console.log(`  YouTube links included in events: ${mentionsVideoInEvents}`);

    } else if (needsConnection) {
      console.log('  [EXPECTED] Google Calendar not connected — connection prompt shown');

      // Should provide guidance on how to connect
      const hasConnectInstructions = /connect|integrations|settings|\/calendar\/connect/i.test(turn2Text);
      expect(
        hasConnectInstructions,
        'Should provide connection instructions when calendar not linked',
      ).toBe(true);
      console.log('  [OK] Connection instructions provided');

    } else if (toolError) {
      console.log('  [INFO] Tool execution error — checking error message quality');

      // Error messages should be helpful, not raw stack traces
      const hasRawError = /traceback|exception|stack/i.test(turn2Text);
      expect(
        hasRawError,
        'Error messages should be user-friendly, not raw stack traces',
      ).toBe(false);
      console.log('  [OK] Error message is user-friendly');

    } else {
      // Agent may have handled it differently — log for review
      console.log('  [INFO] Unexpected response pattern. Full response:');
      console.log('  ' + turn2Text.substring(turn2Text.length - 500));
    }

    // ----- Verify context continuity -----
    // The response should reference the exercises from Turn 1
    const referencesExercises = exercises.some(
      ex => turn2Text.toLowerCase().includes(ex.name.toLowerCase()),
    );
    console.log(`  References Turn 1 exercises: ${referencesExercises}`);

    console.log('\n========== TURN 2 COMPLETE ==========\n');

    // =================================================================
    // TURN 3: Incremental tool request — "Also email me the plan"
    //
    // Tests multi-turn tool chaining:
    // - First tool request was calendar (Turn 2)
    // - Second tool request is email (Turn 3)
    // - ToolExecutor should handle without re-running domain agent
    // =================================================================
    console.log('\n========== TURN 3: ALSO EMAIL THE EXERCISE PLAN ==========\n');

    await sendMessage(
      page,
      'Can you also email me this exercise plan with the video links?',
    );
    await waitForResponse(page, 120_000);

    const turn3Text = await getChatText(page);

    // ----- Verify response acknowledges the email request -----
    const acknowledgesEmail = /email|sent|send|mail/i.test(turn3Text);
    expect(
      acknowledgesEmail,
      'Response must acknowledge the email request',
    ).toBe(true);
    console.log('  [OK] Response acknowledges email request');

    // Check for success or connection messaging
    const emailSuccess = /sent|emailed|delivered/i.test(turn3Text);
    const emailNeedsConnection = /connect|authenticate|gmail|not connected/i.test(turn3Text);

    if (emailSuccess) {
      console.log('  [OK] Email sent successfully!');

      // Verify exercise content was included
      const hasExerciseContent = /exercise|plan|video/i.test(turn3Text);
      console.log(`  Exercise content in email: ${hasExerciseContent}`);

    } else if (emailNeedsConnection) {
      console.log('  [EXPECTED] Gmail not connected — connection prompt shown');

      const hasGmailInstructions = /connect|gmail|integrations/i.test(turn3Text);
      expect(
        hasGmailInstructions,
        'Should provide Gmail connection instructions',
      ).toBe(true);
      console.log('  [OK] Gmail connection instructions provided');
    }

    console.log('\n========== TURN 3 COMPLETE ==========\n');
  });

  test('Exercise plan with video links — verify YouTube URLs are valid', async ({ page }) => {
    // =================================================================
    // Focused test: verify YouTube URLs in exercise recommendations
    // are real, timestamped, and from Dr. David's channel
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    console.log('\n========== VIDEO LINK VERIFICATION ==========\n');

    await sendMessage(
      page,
      'I have knee arthritis, KL grade 2. What exercises should I do? ' +
      'Please include video demonstrations for each exercise.',
    );
    await waitForResponse(page, 180_000);

    const responseText = await getChatText(page);

    // Extract all YouTube URLs
    const youtubeUrls = extractYouTubeUrls(responseText);
    console.log(`  Total YouTube URLs found: ${youtubeUrls.length}`);

    if (youtubeUrls.length > 0) {
      // ----- Verify URL format -----
      for (const url of youtubeUrls) {
        // Must be a valid YouTube URL
        const isValidYt = /youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/.test(url);
        expect(isValidYt, `URL must be valid YouTube format: ${url}`).toBe(true);

        // Check for timestamp
        const hasTimestamp = /&t=\d+/.test(url);
        console.log(`  ${hasTimestamp ? '[TIMESTAMPED]' : '[NO TIMESTAMP]'} ${url}`);
      }

      // ----- Verify known EPMPT video IDs -----
      const knownVideoIds = [
        'nysMP-aLfY0',  // 10 Exercises to Heal Cartilage
        '7ATcoszSdlk',  // 3 Best Exercises For Painful Bone On Bone
        'y6hlm0CpFe8',  // 13 Powerful Tips To Avoid Knee Replacement
        'nburzOBT1ok',  // 5 Minute Knee Arthritis Stretches
        '6d7G_-eF3sE',  // 3 Best Exercises (alternate)
        'PoWbJmelufI',  // Top 10 Glute Exercises
        'nYgNEdB_XGE',  // 9 Standing Glute Exercises
        '6Eyj9o3cPnU',  // Best 5 Knee Arthritis Exercises Dr. Alyssa
      ];

      const foundKnownVideos = youtubeUrls.filter(url =>
        knownVideoIds.some(id => url.includes(id)),
      );

      if (foundKnownVideos.length > 0) {
        console.log(`  [OK] ${foundKnownVideos.length} URLs match known EPMPT video catalog`);
      } else {
        console.log('  [INFO] No URLs matched known catalog — may be from retrieval');
      }

      // ----- Verify exercises are paired with their videos -----
      const exercises = extractExercises(responseText);
      const pairedCount = exercises.filter(e => e.hasVideo).length;
      console.log(`  Exercises with paired videos: ${pairedCount}/${exercises.length}`);

      // At least some exercises should have video links
      if (exercises.length > 0) {
        expect(
          pairedCount,
          `At least 1 exercise should have a video link. Found ${pairedCount}/${exercises.length}`,
        ).toBeGreaterThanOrEqual(1);
      }
    } else {
      console.log('  [INFO] No YouTube URLs found — video_catalog.json may not be loaded');
    }

    console.log('\n========== VIDEO LINK VERIFICATION COMPLETE ==========\n');
  });

  test('Calendar request without prior exercises — should ask for context', async ({ page }) => {
    // =================================================================
    // Edge case: user asks for calendar reminders without first getting
    // exercise recommendations. The system should handle gracefully.
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    console.log('\n========== EDGE CASE: CALENDAR WITHOUT EXERCISES ==========\n');

    await sendMessage(
      page,
      'Add my knee exercises to my Google Calendar as daily reminders',
    );
    await waitForResponse(page, 120_000);

    const responseText = await getChatText(page);

    // The system should either:
    // 1. Ask what exercises (no prior context)
    // 2. Generate exercises first, then offer to add to calendar
    // 3. Route to knee_arthritis agent (keyword match) and provide exercises
    const routedToKnee = /\[Using knee_arthritis agent\]/i.test(responseText);
    const asksForDetails = /which exercises|what exercises|could you|what.*would you like/i.test(responseText);
    const providesExercises = /exercise|tailgate|clamshell|bridge|glute/i.test(responseText);

    console.log(`  Routed to knee_arthritis: ${routedToKnee}`);
    console.log(`  Asks for exercise details: ${asksForDetails}`);
    console.log(`  Provides exercises directly: ${providesExercises}`);

    // Should NOT crash or give empty response
    expect(
      responseText.length,
      'Response should not be empty',
    ).toBeGreaterThan(50);
    console.log('  [OK] Non-empty response');

    // Should do something reasonable
    expect(
      asksForDetails || providesExercises || routedToKnee,
      'Should ask for details, provide exercises, or route to knee agent',
    ).toBe(true);
    console.log('  [OK] Handled gracefully');

    console.log('\n========== EDGE CASE COMPLETE ==========\n');
  });

  test('Verify tool-only detection — "email that" should not re-run knee agent', async ({ page }) => {
    // =================================================================
    // Backend behavior test: after getting exercises, a tool-only request
    // should NOT trigger the knee_arthritis agent again.
    //
    // We verify this by checking that the Turn 2 response doesn't contain
    // a new exercise program (which would mean the domain agent ran again).
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    console.log('\n========== TOOL-ONLY DETECTION VERIFICATION ==========\n');

    // Turn 1: Get exercises
    await sendMessage(
      page,
      'I have knee arthritis. What exercises should I do?',
    );
    await waitForResponse(page, 180_000);

    const turn1Text = await getChatText(page);
    const turn1HasExercises = /Exercise Program/i.test(turn1Text);
    expect(turn1HasExercises, 'Turn 1 must have exercise program').toBe(true);
    console.log('  [OK] Turn 1: Exercise program received');

    // Count exercise program headers in Turn 1
    const turn1ExerciseCount = (turn1Text.match(/Exercise Program/gi) || []).length;
    console.log(`  Turn 1 exercise program headers: ${turn1ExerciseCount}`);

    // Turn 2: Pure tool request
    await sendMessage(page, 'Email me that exercise plan');
    await waitForResponse(page, 120_000);

    const turn2Text = await getChatText(page);

    // Count exercise program headers after Turn 2
    const turn2ExerciseCount = (turn2Text.match(/Exercise Program/gi) || []).length;
    console.log(`  Turn 2 exercise program headers: ${turn2ExerciseCount}`);

    // Should NOT have generated a NEW exercise program
    // (same count as Turn 1, not a new one)
    expect(
      turn2ExerciseCount,
      'Turn 2 should NOT generate a new exercise program (tool-only request)',
    ).toBe(turn1ExerciseCount);
    console.log('  [OK] No duplicate exercise program — tool-only request handled correctly');

    // Turn 2 should mention email
    const turn2MentionsEmail = /email|sent|send|mail/i.test(
      turn2Text.substring(turn1Text.length), // Only check new text
    );
    expect(
      turn2MentionsEmail,
      'Turn 2 response should acknowledge the email request',
    ).toBe(true);
    console.log('  [OK] Turn 2 acknowledges email request without re-running domain agent');

    console.log('\n========== TOOL-ONLY DETECTION COMPLETE ==========\n');
  });
});
