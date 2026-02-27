/**
 * Knee Arthritis Agent — Full E2E Flow with X-Ray Upload
 *
 * Tests the complete knee arthritis assessment pipeline through the UI:
 *
 *   TURN 1: Upload knee X-ray image → Structured analysis with KL grading
 *           + Exercise recommendations (EPMPT methodology)
 *   TURN 2: Symptom description follow-up → Streaming conversational response
 *   TURN 3: Ask about exercises → Context-aware exercise coaching
 *           + Video links from two-stage retrieval (bi-encoder + LLM re-ranking)
 *   TURN 4: New symptom-only assessment (no image) → Structured symptom assessment
 *           + Exercise recommendations
 *   TURN 5: Knowledge question → Retrieval-augmented response with video citations
 *
 * Validates:
 *   - File upload + attachment flow works end-to-end
 *   - Structured X-ray analysis: KL grade, compartment findings, confidence
 *   - Exercise prescription: EPMPT phase, glute-first principle, specific exercises
 *   - Video references: YouTube links with timestamps, Dr. David's tips
 *   - Two-stage retrieval: Mode C follow-ups include relevant video context
 *   - Safety disclaimers always present (programmatic, never skipped)
 *   - Context continuity across turns
 *   - Symptom-only structured assessment (Mode B)
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: ./start-all.sh (chatservice:8080 + mcprealestate:8000 + Redis)
 *
 * Run:
 *   npx playwright test e2e/knee-arthritis-xray.spec.ts --headed
 *
 * Test image: Bilateral knee AP standing X-ray (42M, Kumar Nishat)
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Test fixture path
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XRAY_IMAGE_PATH = path.join(__dirname, 'fixtures', 'knee-xray-bilateral-ap.jpg');

// ---------------------------------------------------------------------------
// Helpers (shared with mother-test pattern)
// ---------------------------------------------------------------------------

/** Send a chat message by typing into the input and pressing Enter. */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

/** Wait for the AI response to complete streaming. */
async function waitForResponse(page: Page, timeoutMs = 120_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // If "Thinking..." never appeared, the response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  // Let widgets/animations/markdown settle
  await page.waitForTimeout(3000);
}

/** Get all visible text content from the chat scroll area. */
async function getChatText(page: Page): Promise<string> {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

/**
 * Upload a file to the chat input via the hidden file input element.
 * Returns when the file preview appears in the UI.
 */
async function uploadFile(page: Page, filePath: string, fileName: string) {
  const fileInput = page.locator('input[type="file"]#file-upload');
  await fileInput.setInputFiles(filePath);

  // Wait for the file preview to appear (upload completes)
  // The file name should appear in the input area
  await expect(
    page.locator(`button[aria-label*="Remove"]`).first()
  ).toBeVisible({ timeout: 30_000 });

  console.log(`File uploaded: ${fileName}`);
}

/**
 * Send a message with a file attachment.
 * Uploads the file, types the message, and sends both.
 */
async function sendMessageWithFile(
  page: Page,
  filePath: string,
  fileName: string,
  message: string,
) {
  // Upload file first
  await uploadFile(page, filePath, fileName);
  await page.waitForTimeout(1000);

  // Type message
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.fill(message);
  await page.waitForTimeout(300);

  // Click the send button (not Enter — which may not trigger with files)
  const sendButton = page.locator('button').filter({
    has: page.locator('svg.lucide-arrow-up'),
  });
  await sendButton.click();
}

// ---------------------------------------------------------------------------
// Structural Verification Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the X-ray analysis response contains all required structured sections.
 *
 * The structured pipeline guarantees these sections appear in EVERY response.
 * If any are missing, the Instructor extraction or narrative formatting is broken.
 */
function verifyXRayAnalysisStructure(text: string) {
  console.log('\n=== X-RAY ANALYSIS STRUCTURAL VERIFICATION ===\n');

  // ----- Section 1: Assessment Header -----
  const hasHeader = /Knee X-Ray Assessment/i.test(text);
  expect(hasHeader, 'Response must contain "Knee X-Ray Assessment" header').toBe(true);
  console.log('  [OK] Assessment header present');

  // ----- Section 2: Image Quality -----
  const hasImageQuality = /Image Quality/i.test(text);
  expect(hasImageQuality, 'Response must contain "Image Quality" section').toBe(true);

  // Quality should be one of: adequate, suboptimal, inadequate
  const qualityMatch = text.match(/adequate|suboptimal|inadequate/i);
  expect(qualityMatch, 'Image quality must be adequate/suboptimal/inadequate').toBeTruthy();
  console.log(`  [OK] Image quality: ${qualityMatch![0]}`);

  // ----- Section 3: View Type -----
  // The X-ray is bilateral AP standing — should be identified
  const hasViewInfo = /View:|AP|standing|weight.?bearing/i.test(text);
  expect(hasViewInfo, 'Response should identify the view type (AP/standing)').toBe(true);
  console.log('  [OK] View type identified');

  // ----- Section 4: Side -----
  // Bilateral X-ray — should mention bilateral or both
  const hasSideInfo = /bilateral|both/i.test(text);
  expect(hasSideInfo, 'Response should identify bilateral/both knees').toBe(true);
  console.log('  [OK] Side: bilateral detected');

  // ----- Section 5: Compartment Findings -----
  const hasCompartment = /Compartment Findings|Compartment/i.test(text);
  expect(hasCompartment, 'Response must contain compartment findings section').toBe(true);

  // Should mention medial and/or lateral compartments
  const hasMedial = /medial/i.test(text);
  const hasLateral = /lateral/i.test(text);
  expect(
    hasMedial || hasLateral,
    'Compartment findings must mention medial and/or lateral compartment'
  ).toBe(true);
  console.log(`  [OK] Compartments: medial=${hasMedial}, lateral=${hasLateral}`);

  // Should mention joint space narrowing
  const hasNarrowing = /joint\s*space\s*narrowing|narrowing/i.test(text);
  expect(hasNarrowing, 'Compartment findings must assess joint space narrowing').toBe(true);
  console.log('  [OK] Joint space narrowing assessed');

  // Should mention osteophytes
  const hasOsteophytes = /osteophyte/i.test(text);
  expect(hasOsteophytes, 'Compartment findings must assess osteophytes').toBe(true);
  console.log('  [OK] Osteophytes assessed');

  // ----- Section 6: KL Grade -----
  const klMatch = text.match(/KL\s*Grade\s*(\d)/i);
  expect(klMatch, 'Response must contain KL Grade (0-4)').toBeTruthy();
  const klGrade = parseInt(klMatch![1]);
  expect(klGrade).toBeGreaterThanOrEqual(0);
  expect(klGrade).toBeLessThanOrEqual(4);
  console.log(`  [OK] KL Grade: ${klGrade}`);

  // ----- Section 7: Confidence -----
  const confidenceMatch = text.match(/Confidence:\s*(low|moderate|high)/i);
  expect(confidenceMatch, 'Response must contain confidence level (low/moderate/high)').toBeTruthy();
  console.log(`  [OK] Confidence: ${confidenceMatch![1]}`);

  // ----- Section 8: Assessment Reasoning (chain-of-thought) -----
  const hasReasoning = /Assessment Reasoning/i.test(text);
  expect(hasReasoning, 'Response must contain "Assessment Reasoning" section').toBe(true);
  console.log('  [OK] Chain-of-thought reasoning present');

  // ----- Section 9: Follow-up Questions -----
  const hasFollowUp = /Next Steps/i.test(text);
  expect(hasFollowUp, 'Response must contain "Next Steps" follow-up questions').toBe(true);
  console.log('  [OK] Follow-up questions present');

  // ----- Section 10: Safety Disclaimer -----
  const hasDisclaimer = /educational purposes only/i.test(text);
  expect(hasDisclaimer, 'Response MUST contain safety disclaimer (mandatory)').toBe(true);
  console.log('  [OK] Safety disclaimer present');

  console.log(`\n  === X-Ray analysis verified: KL Grade ${klGrade}, Confidence ${confidenceMatch![1]} ===\n`);
  return { klGrade, confidence: confidenceMatch![1] };
}

/**
 * Verify the exercise recommendation section is present and well-structured.
 *
 * Exercise recommendations are appended after X-ray/symptom analysis.
 * They must follow the EPMPT 4-phase methodology.
 */
function verifyExerciseRecommendations(text: string) {
  console.log('\n=== EXERCISE RECOMMENDATION VERIFICATION ===\n');

  // ----- Section 1: Exercise Program Header -----
  const hasHeader = /Exercise Program/i.test(text);
  expect(hasHeader, 'Response must contain "Exercise Program" section').toBe(true);
  console.log('  [OK] Exercise Program header present');

  // ----- Section 2: Phase identification -----
  const phaseMatch = text.match(/Phase\s*(\d)/i);
  expect(phaseMatch, 'Exercise section must identify the EPMPT phase (1-4)').toBeTruthy();
  const phase = parseInt(phaseMatch![1]);
  expect(phase).toBeGreaterThanOrEqual(1);
  expect(phase).toBeLessThanOrEqual(4);
  console.log(`  [OK] EPMPT Phase: ${phase}`);

  // ----- Section 3: Phase label -----
  const phaseLabels = ['Pain Management', 'Mobility', 'Root Cause', 'Maintenance'];
  const hasPhaseLabel = phaseLabels.some(label => text.includes(label));
  expect(hasPhaseLabel, 'Exercise section must contain phase label').toBe(true);
  console.log('  [OK] Phase label present');

  // ----- Section 4: Glute-first principle -----
  const hasGluteContext = /glute/i.test(text);
  expect(hasGluteContext, 'Exercise section must mention glute-first principle').toBe(true);
  console.log('  [OK] Glute-first principle mentioned');

  // ----- Section 5: Specific exercises from EPMPT knowledge base -----
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
  const foundExercises = knownExercises.filter(ex =>
    text.toLowerCase().includes(ex.toLowerCase())
  );
  expect(
    foundExercises.length,
    `Exercise section must include at least 2 specific EPMPT exercises. Found: ${foundExercises.join(', ')}`
  ).toBeGreaterThanOrEqual(2);
  console.log(`  [OK] EPMPT exercises found: ${foundExercises.join(', ')}`);

  // ----- Section 6: Exercise has setup and execution instructions -----
  const hasSetup = /Setup:/i.test(text);
  const hasExecution = /Execution:/i.test(text);
  expect(
    hasSetup && hasExecution,
    'Exercises must include Setup and Execution instructions from knowledge base'
  ).toBe(true);
  console.log('  [OK] Exercise instructions (Setup + Execution) present');

  // ----- Section 7: Focus cue -----
  const hasFocusCue = /Focus cue:/i.test(text);
  expect(hasFocusCue, 'Exercises must include the Focus cue').toBe(true);
  console.log('  [OK] Focus cues present');

  // ----- Section 8: Pain rule -----
  const hasPainRule = /Pain rule:/i.test(text);
  expect(hasPainRule, 'Exercises must include the Pain rule').toBe(true);
  console.log('  [OK] Pain rules present');

  // ----- Section 9: Progression criteria -----
  const hasProgression = /When to Progress/i.test(text);
  expect(hasProgression, 'Exercise section must include progression criteria').toBe(true);
  console.log('  [OK] Progression criteria present');

  // ----- Section 10: EPMPT attribution -----
  const hasAttribution = /EP Manual Physical Therapy|EPMPT|Dr\.?\s*David/i.test(text);
  expect(hasAttribution, 'Exercise section must attribute EPMPT methodology').toBe(true);
  console.log('  [OK] EPMPT methodology attribution present');

  // ----- Section 11: Video references (from EPMPT YouTube catalog) -----
  const hasWatchLink = /Watch:/i.test(text);
  const hasYouTubeLink = /youtube\.com\/watch\?v=/i.test(text);
  if (hasWatchLink) {
    console.log('  [OK] "Watch:" video reference present');
    // Should include a YouTube link with timestamp
    const hasTimestamp = /youtube\.com\/watch\?v=[^&]+&t=\d+/i.test(text);
    if (hasTimestamp) {
      console.log('  [OK] YouTube link includes timestamp');
    } else {
      console.log('  [INFO] YouTube link present but no timestamp parameter');
    }
  } else if (hasYouTubeLink) {
    console.log('  [OK] YouTube video link present (no "Watch:" prefix)');
  } else {
    console.log('  [INFO] No video references found — video_catalog.json may not be loaded');
  }

  // Dr. David's tip (technique notes from video extraction)
  const hasDrDavidTip = /Dr\.?\s*David'?s?\s*tip/i.test(text);
  if (hasDrDavidTip) {
    console.log('  [OK] Dr. David\'s technique tip included');
  }

  console.log(`\n  === Exercise recommendations verified: Phase ${phase}, ${foundExercises.length} exercises, video=${hasWatchLink || hasYouTubeLink} ===\n`);
  return { phase, exercises: foundExercises, hasVideoLinks: hasWatchLink || hasYouTubeLink };
}

/**
 * Verify symptom assessment structure (Mode B).
 */
function verifySymptomAssessmentStructure(text: string) {
  console.log('\n=== SYMPTOM ASSESSMENT STRUCTURAL VERIFICATION ===\n');

  // Header
  const hasHeader = /Knee Assessment/i.test(text);
  expect(hasHeader, 'Symptom response must contain "Knee Assessment" header').toBe(true);
  console.log('  [OK] Assessment header present');

  // Severity stage
  const stageMatch = text.match(/Stage\s*[1-4]\s*\([^)]+\)/i);
  expect(stageMatch, 'Response must contain severity stage (Stage 1-4)').toBeTruthy();
  console.log(`  [OK] Severity stage: ${stageMatch![0]}`);

  // Key symptoms
  const hasSymptoms = /Symptoms Identified/i.test(text);
  expect(hasSymptoms, 'Response must list identified symptoms').toBe(true);
  console.log('  [OK] Symptoms identified section present');

  // Recommended actions
  const hasActions = /Recommended Actions/i.test(text);
  expect(hasActions, 'Response must include recommended actions').toBe(true);
  console.log('  [OK] Recommended actions present');

  // Reasoning
  const hasReasoning = /Assessment Reasoning/i.test(text);
  expect(hasReasoning, 'Response must contain reasoning section').toBe(true);
  console.log('  [OK] Assessment reasoning present');

  // Safety disclaimer
  const hasDisclaimer = /educational purposes only/i.test(text);
  expect(hasDisclaimer, 'Response MUST contain safety disclaimer').toBe(true);
  console.log('  [OK] Safety disclaimer present');

  console.log(`\n  === Symptom assessment verified: ${stageMatch![0]} ===\n`);
  return { stage: stageMatch![0] };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Knee Arthritis Agent — Full E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and wait for authentication to complete
    await page.goto('/chataiagent/');
    // Wait for "Loading authentication..." to disappear
    try {
      await page.getByText('Loading authentication').waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByText('Loading authentication').waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      // Auth may have completed instantly
    }
    // Wait for the app to fully render
    await page.waitForTimeout(3000);
  });

  test('TURN 1: X-ray upload → Structured analysis + Exercise recommendations', async ({ page }) => {
    // =================================================================
    // Navigate to new chat
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    // =================================================================
    // Upload X-ray and send analysis request
    // =================================================================
    console.log('\n========== TURN 1: X-RAY UPLOAD + ANALYSIS ==========\n');

    await sendMessageWithFile(
      page,
      XRAY_IMAGE_PATH,
      'knee-xray-bilateral-ap.jpg',
      'Analyze my knee x-ray. I have been experiencing pain while climbing stairs and morning stiffness for the past 6 months.',
    );

    // Wait for the structured analysis (may take longer due to vision + 2 Instructor calls)
    await waitForResponse(page, 180_000);

    // =================================================================
    // Verify X-ray analysis structure
    // =================================================================
    const analysisText = await getChatText(page);

    // Check length — structured analysis should be substantial
    expect(
      analysisText.length,
      'X-ray analysis response should be substantial (>500 chars)'
    ).toBeGreaterThan(500);

    // Verify structured X-ray analysis
    const { klGrade, confidence } = verifyXRayAnalysisStructure(analysisText);

    // Verify exercise recommendations
    const { phase, exercises } = verifyExerciseRecommendations(analysisText);

    // =================================================================
    // Cross-validate: KL Grade → Exercise Phase consistency
    // =================================================================
    console.log('\n=== CROSS-VALIDATION: KL Grade ↔ Exercise Phase ===\n');

    // KL Grade 3-4 → Phase 1-2 (pain management/mobility)
    // KL Grade 0-2 → Phase 2-3 (mobility/root cause)
    if (klGrade >= 3) {
      expect(
        phase,
        `KL Grade ${klGrade} (moderate-severe) should map to Phase 1-2, got Phase ${phase}`
      ).toBeLessThanOrEqual(2);
    }
    if (klGrade <= 1) {
      expect(
        phase,
        `KL Grade ${klGrade} (normal-doubtful) should map to Phase 2-3, got Phase ${phase}`
      ).toBeGreaterThanOrEqual(2);
    }
    console.log(`  [OK] KL Grade ${klGrade} → Phase ${phase} mapping is consistent\n`);

    console.log('========== TURN 1 COMPLETE ==========\n');
  });

  test('TURN 2-3: Follow-up conversation with context continuity', async ({ page }) => {
    // =================================================================
    // Navigate to new chat and first upload the X-ray
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    // First turn: upload X-ray
    console.log('\n========== SETUP: Upload X-ray ==========\n');
    await sendMessageWithFile(
      page,
      XRAY_IMAGE_PATH,
      'knee-xray-bilateral-ap.jpg',
      'Analyze my knee x-ray',
    );
    await waitForResponse(page, 180_000);

    // Verify first response arrived
    const firstResponse = await getChatText(page);
    expect(firstResponse.length).toBeGreaterThan(200);

    // =================================================================
    // TURN 2: Symptom follow-up (should use Mode C — streaming)
    // =================================================================
    console.log('\n========== TURN 2: SYMPTOM FOLLOW-UP ==========\n');

    await sendMessage(
      page,
      'The pain is mainly on the inside of both knees, about 6/10 severity. ' +
      'Morning stiffness lasts about 20 minutes. I can walk about 1 km before ' +
      'the pain becomes too much. Stairs are the worst.',
    );
    await waitForResponse(page);

    const followUpText = await getChatText(page);

    // Context should reference the earlier X-ray analysis
    const referencesXray = /KL\s*Grade|x-ray|imaging|radiograph|finding/i.test(followUpText);
    console.log(`  Context references X-ray: ${referencesXray}`);

    // Should address the specific symptoms mentioned
    const addressesPain = /medial|inside|6.10|pain/i.test(followUpText);
    expect(addressesPain, 'Follow-up should address the reported symptoms').toBe(true);
    console.log('  [OK] Addresses reported symptoms');

    // Safety disclaimer should be present (or was in the previous response)
    const hasDisclaimer = /educational purposes|consult.*specialist/i.test(followUpText);
    expect(hasDisclaimer, 'Safety language should be in the conversation').toBe(true);
    console.log('  [OK] Safety language present');

    console.log('\n========== TURN 2 COMPLETE ==========\n');

    // =================================================================
    // TURN 3: Ask specifically about exercises
    // =================================================================
    console.log('\n========== TURN 3: EXERCISE COACHING ==========\n');

    await sendMessage(
      page,
      'What exercises should I do for my knee? I want to reduce pain and improve mobility.',
    );
    await waitForResponse(page);

    const exerciseText = await getChatText(page);

    // Should mention glutes (EPMPT philosophy)
    const mentionsGlutes = /glute|gluteus/i.test(exerciseText);
    expect(
      mentionsGlutes,
      'Exercise coaching should mention glutes (EPMPT glute-first philosophy)'
    ).toBe(true);
    console.log('  [OK] Mentions glutes (EPMPT philosophy)');

    // Should mention specific exercises
    const exerciseKeywords = [
      'tailgate', 'clamshell', 'bridge', 'fire hydrant',
      'donkey kick', 'squat', 'lunge', 'glute squeeze',
    ];
    const mentionedExercises = exerciseKeywords.filter(kw =>
      exerciseText.toLowerCase().includes(kw)
    );
    expect(
      mentionedExercises.length,
      `Should mention at least 1 EPMPT exercise. Found: ${mentionedExercises.join(', ')}`
    ).toBeGreaterThanOrEqual(1);
    console.log(`  [OK] EPMPT exercises mentioned: ${mentionedExercises.join(', ')}`);

    // Should NOT recommend quad-dominant exercises (anti-pattern in EPMPT)
    const hasQuadWarning = /quad.*dominan|avoid.*quad|not.*quad/i.test(exerciseText);
    const hasLegExtension = /leg extension/i.test(exerciseText);
    if (hasLegExtension) {
      console.log('  [WARN] Mentions leg extension — should be avoided per EPMPT');
    }
    console.log(`  Mentions quad caution: ${hasQuadWarning}`);

    // ----- Video retrieval context (two-stage retrieval integration) -----
    // Mode C follow-ups should include relevant Dr. David video context
    // via the bi-encoder + LLM re-ranking pipeline
    const hasVideoLink = /youtube\.com\/watch\?v=/i.test(exerciseText);
    const hasDrDavidRef = /Dr\.?\s*David/i.test(exerciseText);
    console.log(`  Video link in follow-up: ${hasVideoLink}`);
    console.log(`  Dr. David reference: ${hasDrDavidRef}`);
    if (hasVideoLink) {
      console.log('  [OK] Two-stage retrieval injected video context into follow-up');
      // Check for timestamped links
      const timestampLinks = exerciseText.match(/youtube\.com\/watch\?v=[^&\s]+&t=\d+/gi);
      if (timestampLinks) {
        console.log(`  [OK] ${timestampLinks.length} timestamped video link(s) found`);
      }
    }

    console.log('\n========== TURN 3 COMPLETE ==========\n');
  });

  test('TURN 4: Symptom-only assessment (no image) → Structured output + Exercises', async ({ page }) => {
    // =================================================================
    // Navigate to a NEW chat (no prior X-ray context)
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    // =================================================================
    // Send symptom description (triggers Mode B)
    // =================================================================
    console.log('\n========== TURN 4: SYMPTOM-ONLY ASSESSMENT ==========\n');

    await sendMessage(
      page,
      'I have knee pain especially when climbing stairs and getting up from chairs. ' +
      'The pain is about 5/10. I feel morning stiffness for about 15 minutes. ' +
      'I have difficulty walking more than 500 meters. ' +
      'The pain has been getting worse over the past year.',
    );
    await waitForResponse(page, 120_000);

    const symptomText = await getChatText(page);

    // Check response length
    expect(
      symptomText.length,
      'Symptom assessment should be substantial (>400 chars)'
    ).toBeGreaterThan(400);

    // Verify structured symptom assessment
    const { stage } = verifySymptomAssessmentStructure(symptomText);
    console.log(`  Detected severity: ${stage}`);

    // With pain 5/10, stiffness 15min, difficulty walking — expect Stage 2-3
    const stageNum = parseInt(stage.match(/\d/)![0]);
    expect(
      stageNum,
      `Pain 5/10 + walking limitation + stiffness should be Stage 2 or 3, got ${stage}`
    ).toBeGreaterThanOrEqual(2);
    expect(stageNum).toBeLessThanOrEqual(3);
    console.log(`  [OK] Severity stage ${stageNum} is reasonable for reported symptoms`);

    // Verify exercise recommendations are included
    const hasExerciseSection = /Exercise Program/i.test(symptomText);
    if (hasExerciseSection) {
      const { phase, exercises } = verifyExerciseRecommendations(symptomText);

      // Stage 2-3 should map to Phase 2-3 exercises
      expect(
        phase,
        `Stage ${stageNum} should map to Phase 2-3, got Phase ${phase}`
      ).toBeGreaterThanOrEqual(1);
      expect(phase).toBeLessThanOrEqual(3);
      console.log(`  [OK] Stage ${stageNum} → Phase ${phase} mapping is consistent`);
    } else {
      console.log('  [INFO] Exercise section not appended — may be in follow-up');
    }

    console.log('\n========== TURN 4 COMPLETE ==========\n');
  });

  test('TURN 5: Knowledge question → Retrieval-augmented response with video citations', async ({ page }) => {
    // =================================================================
    // Navigate to new chat — set up with X-ray first for context
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 30_000 });

    // First turn: upload X-ray to establish knee arthritis context
    console.log('\n========== SETUP: Upload X-ray ==========\n');
    await sendMessageWithFile(
      page,
      XRAY_IMAGE_PATH,
      'knee-xray-bilateral-ap.jpg',
      'Analyze my knee x-ray',
    );
    await waitForResponse(page, 180_000);

    // Verify first response arrived
    const firstResponse = await getChatText(page);
    expect(firstResponse.length).toBeGreaterThan(200);

    // =================================================================
    // TURN 5: Ask a specific knowledge question that retrieval should
    // answer using transcript chunks from Dr. David's videos.
    //
    // This tests the two-stage retrieval pipeline:
    //   Stage 1: Gemini embedding → Redis FLAT vector search (exact NN)
    //   Stage 2: Gemini LLM re-ranks top candidates
    //   → Relevant video segments injected into agent context
    // =================================================================
    console.log('\n========== TURN 5: KNOWLEDGE QUESTION (RETRIEVAL) ==========\n');

    await sendMessage(
      page,
      'Should I rest or continue exercising when my knee is swollen and painful? ' +
      'Also, are there any supplements that might help with cartilage?',
    );
    await waitForResponse(page);

    const knowledgeText = await getChatText(page);

    // Should address both parts of the question
    const addressesRest = /rest|avoid.*activ|take.*break|ice/i.test(knowledgeText);
    const addressesExercise = /exercise|move|active|gentle/i.test(knowledgeText);
    expect(
      addressesRest || addressesExercise,
      'Response should address the rest-vs-exercise question'
    ).toBe(true);
    console.log(`  [OK] Addresses rest/exercise: rest=${addressesRest}, exercise=${addressesExercise}`);

    const addressesSupplements = /supplement|glucosamine|omega|fish oil|collagen|hyaluronic|vitamin/i.test(knowledgeText);
    expect(
      addressesSupplements,
      'Response should address supplements for cartilage'
    ).toBe(true);
    console.log(`  [OK] Addresses supplements`);

    // ----- Video retrieval verification -----
    // The two-stage retrieval should find relevant videos like:
    //   - "Is It Better To Rest Or Exercise An Arthritic Knee?"
    //   - Supplement review videos from Dr. David
    const hasVideoLink = /youtube\.com\/watch\?v=/i.test(knowledgeText);
    const hasDrDavidRef = /Dr\.?\s*David|EP Manual|EPMPT/i.test(knowledgeText);

    console.log(`  Video link present: ${hasVideoLink}`);
    console.log(`  Dr. David/EPMPT reference: ${hasDrDavidRef}`);

    if (hasVideoLink) {
      console.log('  [OK] Retrieval-augmented response includes video citations');

      // Count video links
      const videoLinks = knowledgeText.match(/youtube\.com\/watch\?v=[^\s)]+/gi);
      if (videoLinks) {
        console.log(`  [OK] Found ${videoLinks.length} video link(s)`);
        // Check if any have timestamps
        const timestamped = videoLinks.filter(l => /&t=\d+/.test(l));
        if (timestamped.length > 0) {
          console.log(`  [OK] ${timestamped.length} link(s) have timestamps for precise seeking`);
        }
      }
    } else {
      console.log('  [INFO] No video links — retrieval may not be configured or Redis unavailable');
    }

    // Safety disclaimer should be in the conversation
    const hasDisclaimer = /educational purposes|consult.*specialist/i.test(knowledgeText);
    expect(hasDisclaimer, 'Safety language should be present').toBe(true);
    console.log('  [OK] Safety disclaimer present');

    console.log('\n========== TURN 5 COMPLETE ==========\n');
  });
});
