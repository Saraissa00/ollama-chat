'use strict';
const { chromium } = require('playwright');
const { spawnSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname);
const OUT  = path.join(BASE, 'demo-output');
const W = 1920, H = 1080;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- TTS via Windows SAPI ----------
function makeTTS(text, wavPath) {
  const esc     = text.replace(/'/g, "''");
  const winPath = wavPath.replace(/\//g, '\\');
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "$s.SelectVoice('Microsoft Zira Desktop')",
    '$s.Rate = -1',
    `$s.SetOutputToWaveFile('${winPath}')`,
    `$s.Speak('${esc}')`,
    '$s.Dispose()',
  ].join('; ');
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'pipe' });
}

function getMs(wavPath) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', wavPath,
  ], { encoding: 'utf8' });
  return Math.round(parseFloat(r.stdout.trim()) * 1000);
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status}`);
}

// ---------- main ----------
async function main() {
  // Clean output dir
  if (fs.existsSync(OUT)) fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  fs.mkdirSync(OUT, { recursive: true });

  // Voiceover lines (indexed)
  const lines = [
    // 0 — intro
    'Welcome to Ollama Chat. A modern web application for chatting with powerful AI models, running entirely on your own machine. No internet required. Complete privacy.',
    // 1 — main UI tour
    'This is the main chat interface. A clean dark theme connects to your local Ollama instance. Your messages stay on your device and never leave your machine.',
    // 2 — "let's start a conversation"
    "Let's start a conversation.",
    // 3 — explain streaming
    'The AI streams its response in real time, word by word, pulled directly from the local model running on your device.',
    // 4 — intro simple version
    "Now let's take a look at the simple version. A lightweight, minimal interface designed for learning and experimentation.",
    // 5 — simple UI tour
    'Here is the simple chat page. Same functionality in a clean, minimal layout, with a clear button to reset the conversation and a link back to the full interface.',
    // 6 — "let's send one more"
    "Let's send one more message here.",
    // 7 — outro
    'Ollama Chat. Powerful local AI. Completely offline. Completely yours.',
  ];

  // --- Generate TTS ---
  console.log('Generating voiceover...\n');
  const wavPaths  = [];
  const durations = [];
  for (let i = 0; i < lines.length; i++) {
    const wp = path.join(OUT, `line_${i}.wav`);
    makeTTS(lines[i], wp);
    const d = getMs(wp);
    wavPaths.push(wp);
    durations.push(d);
    console.log(`  [${i}] ${(d / 1000).toFixed(1)}s — "${lines[i].slice(0, 55)}..."`);
  }

  // --- Build timeline ---
  const PAD         = 1500;   // silence before first line
  const GAP         = 900;    // gap after each line before next cue
  const AI_WAIT     = 13000;  // time budget for AI to respond
  const TYPE_DELAY  = 45;     // ms per character (looks natural)

  const mainQ   = 'What is artificial intelligence, in one sentence?';
  const simpleQ = 'Give me one fun fact about outer space.';

  let t = PAD;
  const starts = []; // audio start (ms) for each line

  // Line 0 — intro
  starts.push(t); t += durations[0] + GAP;

  // Line 1 — UI tour
  starts.push(t); t += durations[1] + GAP;

  // Line 2 — "let's start a conversation"
  starts.push(t);
  const typeMainAt = t + 1200;
  const sendMainAt = typeMainAt + mainQ.length * TYPE_DELAY + 700;
  t = sendMainAt + AI_WAIT;

  // Line 3 — streaming response
  starts.push(t); t += durations[3] + GAP;

  // Line 4 — intro simple
  starts.push(t);
  const navAt = t + durations[4] - 600;   // navigate near end of line
  t += durations[4] + GAP;

  // Line 5 — simple UI tour
  starts.push(t); t += durations[5] + GAP;

  // Line 6 — "let's send one more"
  starts.push(t);
  const typeSimpleAt  = t + 900;
  const sendSimpleAt  = typeSimpleAt + simpleQ.length * TYPE_DELAY + 700;
  t = sendSimpleAt + AI_WAIT;

  // Line 7 — outro
  starts.push(t); t += durations[7] + 1500;

  const TOTAL_MS = t;
  console.log(`\nTotal video: ${(TOTAL_MS / 1000).toFixed(1)}s`);
  console.log('Audio cues (s):', starts.map(s => (s / 1000).toFixed(1)).join(', '));

  // --- Record browser ---
  console.log('\nRecording browser...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  const videoObj = page.video();

  const t0 = Date.now();
  const waitUntil = async target => {
    const rem = target - (Date.now() - t0);
    if (rem > 10) await sleep(rem);
  };

  // Load main page
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Type question character by character
  await waitUntil(typeMainAt);
  for (const ch of mainQ) {
    await page.type('textarea', ch);
    await sleep(TYPE_DELAY);
  }

  // Send
  await waitUntil(sendMainAt);
  await page.click('button:has-text("Send")');

  // Navigate to /simple
  await waitUntil(navAt);
  await page.goto('http://localhost:3000/simple');
  await page.waitForLoadState('networkidle');

  // Type on simple page
  await waitUntil(typeSimpleAt);
  for (const ch of simpleQ) {
    await page.type('input[type="text"]', ch);
    await sleep(TYPE_DELAY);
  }

  // Send
  await waitUntil(sendSimpleAt);
  await page.click('button:has-text("Send")');

  // Hold until full duration
  await waitUntil(TOTAL_MS);

  await context.close();
  const videoPath = await videoObj.path();
  await browser.close();
  console.log('\nVideo saved:', videoPath);

  // --- Assemble audio ---
  console.log('\nAssembling voiceover audio...');
  const audioOut = path.join(OUT, 'voiceover.wav');

  const filterParts = wavPaths.map((_, i) =>
    `[${i}:a]adelay=${starts[i]}|${starts[i]}[a${i}]`
  );
  const mixLabel = wavPaths.map((_, i) => `[a${i}]`).join('');
  const filterComplex = [
    ...filterParts,
    `${mixLabel}amix=inputs=${wavPaths.length}:normalize=0[out]`,
  ].join('; ');

  ffmpeg([
    '-y',
    ...wavPaths.flatMap(p => ['-i', p]),
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-t', String(TOTAL_MS / 1000),
    audioOut,
  ]);

  // --- Render final MP4 ---
  console.log('\nRendering final MP4...');
  const finalOut = path.join(OUT, 'ollama-chat-demo.mp4');
  ffmpeg([
    '-y',
    '-i', videoPath,
    '-i', audioOut,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    finalOut,
  ]);

  console.log(`\n✓ Done!\n  ${finalOut}`);
}

main().catch(err => { console.error('\n✗', err.message); process.exit(1); });
