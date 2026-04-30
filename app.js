const STORAGE_KEY = "revision-timetable-v1";
const THEME_KEY = "revision-timetable-theme";
const SUPABASE_URL = "https://rtzlegjqfznyckngsyzq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0emxlZ2pxZnpueWNrbmdzeXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDA3NTQsImV4cCI6MjA5MzExNjc1NH0.s_ougifMkTuTcza8XTtizJEG_c6Qbd6gG3X8paUSlJ0";
const SUPABASE_TABLE = "revision_profiles";
const SCHEDULE_VERSION = 2;
const PLAN_START = "2026-04-30";
const PLAN_END = "2026-06-04";
const DAY_START_MINUTES = 9 * 60;
const DAY_END_MINUTES = 17 * 60;
const CALENDAR_STEP_MINUTES = 15;
const CALENDAR_PIXELS_PER_MINUTE = 1.15;
const PROFILES = [
  { id: "christian", name: "Christian" },
  { id: "luca", name: "Luca" },
  { id: "will", name: "Will" },
];

const BLOCKS = [
  { start: "09:00", end: "10:30", duration: 90 },
  { start: "10:45", end: "12:15", duration: 90 },
  { start: "13:15", end: "14:45", duration: 90 },
  { start: "15:00", end: "16:30", duration: 90 },
];

const SESSION_TYPES = [
  "Topic study",
  "Active recall",
  "Practice questions",
  "Past-paper practice",
  "Light review",
];

const TOPIC_FLOW = ["Topic study", "Active recall", "Practice questions"];
const POINTS = {
  session: 10,
  topic: 50,
  module: 150,
};

const SUBJECTS = [
  {
    id: "am",
    name: "Additive Manufacturing",
    shortName: "AM",
    credits: 5,
    color: "#0f766e",
    examDate: "2026-05-18",
    topics: [
      "Introduction to AM",
      "Polymer Powder Bed Fusion",
      "Vat polymerisation",
      "Binder Jetting",
      "Material Jetting",
      "Metal Additive Manufacturing",
      "Critical Thinking in AM",
      "Management and Operations of AM",
      "Economics and Sustainability of AM",
      "Design for AM part 1 & 2",
    ],
  },
  {
    id: "cfd",
    name: "Computational Fluid Dynamics",
    shortName: "CFD",
    credits: 10,
    color: "#7c3aed",
    examDate: "2026-06-04",
    topics: [
      "Governing Equations",
      "Meshing",
      "Boundary Conditions",
      "Turbulence",
      "Numerics",
      "Multiphase Flow",
    ],
  },
  {
    id: "se",
    name: "Systems Engineering",
    shortName: "SE",
    credits: 5,
    color: "#c2410c",
    examDate: "2026-05-28",
    topics: [
      "Introduction to Systems Engineering",
      "ConOps",
      "Requirements",
      "Architectures and Interfaces",
      "Managing the Systems Engineering Process",
      "A Systems Approach to Test and Evaluation",
      "A Systems Approach to Design and Optimisation",
      "Qualitative Risk and Reliability Assessment",
      "Quantitative Risk and Reliability Assessment",
      "Systems of Systems & Future of SE",
    ],
  },
];

let appState = loadAppState();
let state = getActiveProfileState();
let ganttStartOffset = 0;
let calendarEditorStart = getStudyTodayIso();
let calendarDrag = null;
let tooltipWarmTimer = null;
let supabaseClient = null;
let remoteSyncTimer = null;
let isApplyingRemoteState = false;

const els = {
  saveState: document.querySelector("#saveState"),
  lightThemeBtn: document.querySelector("#lightThemeBtn"),
  darkThemeBtn: document.querySelector("#darkThemeBtn"),
  profileSelect: document.querySelector("#profileSelect"),
  countdowns: document.querySelector("#countdowns"),
  todaySummary: document.querySelector("#todaySummary"),
  todayList: document.querySelector("#todayList"),
  dashboardProgress: document.querySelector("#dashboardProgress"),
  profileComparison: document.querySelector("#profileComparison"),
  focusNext: document.querySelector("#focusNext"),
  ganttRange: document.querySelector("#ganttRange"),
  ganttPanel: document.querySelector("#ganttPanel"),
  ganttToggle: document.querySelector("#ganttToggle"),
  ganttToggleText: document.querySelector("#ganttToggleText"),
  ganttWindowLabel: document.querySelector("#ganttWindowLabel"),
  ganttChart: document.querySelector("#ganttChart"),
  calendarRange: document.querySelector("#calendarRange"),
  calendarStart: document.querySelector("#calendarStart"),
  calendarPrevBtn: document.querySelector("#calendarPrevBtn"),
  calendarNextBtn: document.querySelector("#calendarNextBtn"),
  calendarEditor: document.querySelector("#calendarEditor"),
  calendar: document.querySelector("#calendar"),
  topicGrid: document.querySelector("#topicGrid"),
  progressGrid: document.querySelector("#progressGrid"),
  subjectFilter: document.querySelector("#subjectFilter"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  addSessionBtn: document.querySelector("#addSessionBtn"),
  catchUpBtn: document.querySelector("#catchUpBtn"),
  restructureBtn: document.querySelector("#restructureBtn"),
  regenerateBtn: document.querySelector("#regenerateBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  dialog: document.querySelector("#sessionDialog"),
  restructureDialog: document.querySelector("#restructureDialog"),
  restructureText: document.querySelector("#restructureText"),
  restructureWarning: document.querySelector("#restructureWarning"),
  restructurePrompt: document.querySelector("#restructurePrompt"),
  copyRestructureBtn: document.querySelector("#copyRestructureBtn"),
  copyRestructureState: document.querySelector("#copyRestructureState"),
  sessionForm: document.querySelector("#sessionForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  sessionId: document.querySelector("#sessionId"),
  sessionDate: document.querySelector("#sessionDate"),
  sessionTime: document.querySelector("#sessionTime"),
  sessionSubject: document.querySelector("#sessionSubject"),
  sessionTopic: document.querySelector("#sessionTopic"),
  sessionType: document.querySelector("#sessionType"),
  sessionDuration: document.querySelector("#sessionDuration"),
  sessionNotes: document.querySelector("#sessionNotes"),
  deleteSessionBtn: document.querySelector("#deleteSessionBtn"),
};

initialiseControls();
applyTheme(loadTheme());
render();
initialiseSupabaseSync();

function makeDefaultState() {
  const subjects = SUBJECTS.map((subject) => ({
    ...subject,
    topics: subject.topics.map((title, index) => ({
      id: `${subject.id}-topic-${index + 1}`,
      title,
      complete: false,
    })),
  }));

  return {
    scheduleVersion: SCHEDULE_VERSION,
    subjects,
    sessions: generateSessions(subjects),
  };
}

function makeDefaultAppState() {
  return {
    activeProfile: "christian",
    profiles: Object.fromEntries(PROFILES.map((profile) => [profile.id, makeDefaultState()])),
  };
}

function loadAppState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return makeDefaultAppState();

  try {
    const parsed = JSON.parse(stored);
    if (parsed.profiles) return normaliseAppState(parsed);
    if (parsed.subjects && parsed.sessions) return migrateSingleProfileState(parsed);
    return makeDefaultAppState();
  } catch {
    return makeDefaultAppState();
  }
}

function normaliseAppState(parsed) {
  const next = makeDefaultAppState();
  next.activeProfile = PROFILES.some((profile) => profile.id === parsed.activeProfile)
    ? parsed.activeProfile
    : "christian";

  PROFILES.forEach((profile) => {
    next.profiles[profile.id] = normaliseProfileState(parsed.profiles[profile.id]);
  });

  return next;
}

function migrateSingleProfileState(parsed) {
  const next = makeDefaultAppState();
  next.profiles.christian = normaliseProfileState(parsed);
  next.activeProfile = "christian";
  return next;
}

function normaliseProfileState(profileState) {
  if (!profileState?.subjects || !profileState?.sessions) return makeDefaultState();
  if (profileState.scheduleVersion !== SCHEDULE_VERSION) {
    return {
      ...profileState,
      scheduleVersion: SCHEDULE_VERSION,
      sessions: generateSessions(profileState.subjects),
    };
  }
  return profileState;
}

function getActiveProfileState() {
  return appState.profiles[appState.activeProfile];
}

function saveState() {
  appState.profiles[appState.activeProfile] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  els.saveState.textContent = `Saved for ${getActiveProfile().name}`;
  els.saveState.classList.remove("unsaved");
  if (!isApplyingRemoteState) saveActiveProfileRemote();
}

function markDirtyAndSave() {
  els.saveState.textContent = "Saving...";
  els.saveState.classList.add("unsaved");
  window.setTimeout(saveState, 120);
}

async function initialiseSupabaseSync() {
  if (!window.supabase?.createClient) {
    els.saveState.textContent = "Saved locally";
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await pullRemoteProfiles();
  await seedMissingRemoteProfiles();

  remoteSyncTimer = window.setInterval(pullRemoteProfiles, 8000);
  window.addEventListener("beforeunload", () => {
    if (remoteSyncTimer) window.clearInterval(remoteSyncTimer);
  });
}

async function pullRemoteProfiles() {
  if (!supabaseClient) return;
  if (calendarDrag || els.dialog.open || els.restructureDialog.open) return;

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("id,data,updated_at")
    .in("id", PROFILES.map((profile) => profile.id));

  if (error) {
    els.saveState.textContent = "Local save only";
    return;
  }

  if (!data?.length) return;

  isApplyingRemoteState = true;
  data.forEach((row) => {
    if (!appState.profiles[row.id]) return;
    appState.profiles[row.id] = normaliseProfileState(row.data);
  });
  state = getActiveProfileState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  isApplyingRemoteState = false;
  els.saveState.textContent = `Synced for ${getActiveProfile().name}`;
  els.saveState.classList.remove("unsaved");
  render();
}

async function seedMissingRemoteProfiles() {
  if (!supabaseClient) return;

  const rows = PROFILES.map((profile) => ({
    id: profile.id,
    data: appState.profiles[profile.id],
    updated_at: new Date().toISOString(),
  }));

  await supabaseClient
    .from(SUPABASE_TABLE)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
}

async function saveActiveProfileRemote() {
  return saveProfileRemote(appState.activeProfile, state);
}

async function saveProfileRemote(profileId, profileState) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .upsert({
      id: profileId,
      data: profileState,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) {
    els.saveState.textContent = "Local save only";
    return;
  }

  els.saveState.textContent = `Synced for ${getActiveProfile().name}`;
}

function initialiseControls() {
  PROFILES.forEach((profile) => {
    els.profileSelect.append(new Option(profile.name, profile.id));
  });
  els.profileSelect.value = appState.activeProfile;

  SUBJECTS.forEach((subject) => {
    els.subjectFilter.append(new Option(subject.name, subject.id));
    els.sessionSubject.append(new Option(subject.name, subject.id));
  });

  BLOCKS.forEach((block) => {
    els.sessionTime.append(new Option(`${block.start}-${block.end}`, block.start));
  });

  SESSION_TYPES.forEach((type) => {
    els.sessionType.append(new Option(type, type));
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.lightThemeBtn.addEventListener("click", () => setTheme("light"));
  els.darkThemeBtn.addEventListener("click", () => setTheme("dark"));
  els.profileSelect.addEventListener("change", switchProfile);
  els.ganttRange.addEventListener("change", handleGanttRangeChange);
  els.ganttToggle.addEventListener("click", toggleGanttPanel);
  els.calendarRange.addEventListener("change", renderCalendarEditor);
  els.calendarStart.addEventListener("change", handleCalendarStartChange);
  els.calendarPrevBtn.addEventListener("click", () => shiftCalendarEditor(-1));
  els.calendarNextBtn.addEventListener("click", () => shiftCalendarEditor(1));
  els.subjectFilter.addEventListener("change", renderCalendar);
  els.addSessionBtn.addEventListener("click", () => openSessionDialog());
  els.catchUpBtn.addEventListener("click", reorganiseCatchUpPlan);
  els.restructureBtn.addEventListener("click", openRestructureDialog);
  els.restructureText.addEventListener("input", updateRestructurePrompt);
  els.copyRestructureBtn.addEventListener("click", copyRestructurePrompt);
  els.regenerateBtn.addEventListener("click", regeneratePlan);
  els.resetBtn.addEventListener("click", resetAll);
  els.sessionSubject.addEventListener("change", () => populateTopicSelect(els.sessionSubject.value));
  els.sessionForm.addEventListener("submit", handleSessionSubmit);
  els.deleteSessionBtn.addEventListener("click", deleteCurrentSession);
  initialiseTooltips();
}

function initialiseTooltips() {
  document.querySelectorAll("[data-tooltip]").forEach((control) => {
    control.addEventListener("pointerenter", () => {
      window.clearTimeout(tooltipWarmTimer);
      tooltipWarmTimer = window.setTimeout(() => {
        document.body.classList.add("tooltip-warm");
      }, 1000);
    });

    control.addEventListener("pointerleave", () => {
      window.clearTimeout(tooltipWarmTimer);
      tooltipWarmTimer = window.setTimeout(() => {
        document.body.classList.remove("tooltip-warm");
      }, 900);
    });
  });
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.lightThemeBtn.classList.toggle("active", theme === "light");
  els.darkThemeBtn.classList.toggle("active", theme === "dark");
}

function render() {
  renderProfileTitle();
  renderDashboard();
  renderCountdowns();
  renderCalendar();
  renderCalendarEditor();
  renderTopics();
  renderProgress();
}

function renderProfileTitle() {
  els.saveState.textContent = `Saved for ${getActiveProfile().name}`;
}

function switchProfile() {
  const previousProfile = appState.activeProfile;
  appState.profiles[appState.activeProfile] = state;
  appState.activeProfile = els.profileSelect.value;
  state = getActiveProfileState();
  saveProfileRemote(previousProfile, appState.profiles[previousProfile]);
  saveState();
  render();
}

function getActiveProfile() {
  return PROFILES.find((profile) => profile.id === appState.activeProfile) || PROFILES[0];
}

function switchView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function renderDashboard() {
  const todayIso = getStudyTodayIso();
  const metrics = getProfileMetrics(state);
  const todaySessions = state.sessions
    .filter((session) => session.date === todayIso)
    .sort((a, b) => a.start.localeCompare(b.start));
  const missed = getMissedSessions(state, todayIso);

  els.todaySummary.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><strong>${metrics.sessionPct}%</strong><span>sessions done</span></div>
      <div class="kpi"><strong>${todaySessions.length}</strong><span>today's blocks</span></div>
      <div class="kpi"><strong>${missed.length}</strong><span>missed sessions</span></div>
    </div>
  `;

  els.todayList.innerHTML = "";
  if (!todaySessions.length) {
    els.todayList.innerHTML = `<div class="free-day">No study blocks today.</div>`;
  } else {
    todaySessions.forEach((session) => {
      els.todayList.append(renderMiniSession(session));
    });
  }

  els.dashboardProgress.innerHTML = `
    <div class="stat-line"><span>Completed sessions</span><strong>${metrics.completeSessions}/${metrics.totalSessions}</strong></div>
    <div class="meter"><span style="--value:${metrics.sessionPct}%"></span></div>
    <div class="stat-line"><span>Completed topics</span><strong>${metrics.completeTopics}/${metrics.totalTopics}</strong></div>
    <div class="meter"><span style="--value:${metrics.topicPct}%"></span></div>
    <div class="stat-line"><span>Upcoming study blocks</span><strong>${metrics.upcomingSessions}</strong></div>
  `;

  renderProfileComparison();
  renderFocusNext(todayIso, missed);
}

function renderMiniSession(session) {
  const subject = getSubject(session.subjectId);
  const topic = getTopic(session.subjectId, session.topicId);
  const item = document.createElement("div");
  item.className = `mini-session${session.complete ? " complete" : ""}`;
  item.style.setProperty("--subject-color", subject.color);
  item.innerHTML = `
    <strong>${session.start}-${session.end} - ${subject.shortName}: ${escapeHtml(session.type)}</strong>
    <span>${escapeHtml(topic?.title || "Custom topic")}${session.complete ? " - complete" : ""}</span>
  `;
  return item;
}

function renderProfileComparison() {
  els.profileComparison.innerHTML = `
    <div class="leaderboard-list"></div>
    <div class="leaderboard-key">
      ${POINTS.session} pts/session | ${POINTS.topic} pts/topic | ${POINTS.module} pts/module
    </div>
  `;
  const list = els.profileComparison.querySelector(".leaderboard-list");
  const rows = PROFILES.map((profile) => ({
    profile,
    score: getProfileScore(appState.profiles[profile.id]),
  })).sort((a, b) => {
    if (b.score.points !== a.score.points) return b.score.points - a.score.points;
    if (b.score.completeTopics !== a.score.completeTopics) return b.score.completeTopics - a.score.completeTopics;
    return b.score.completeSessions - a.score.completeSessions;
  });

  rows.forEach(({ profile, score }, index) => {
    const row = document.createElement("div");
    row.className = `leaderboard-row${profile.id === appState.activeProfile ? " current" : ""}`;
    row.style.setProperty("--subject-color", profile.id === "christian" ? "#1d4ed8" : profile.id === "luca" ? "#0f766e" : "#c2410c");
    row.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <div>
        <strong>${profile.name}</strong>
        <span>${score.completeSessions} sessions | ${score.completeTopics} topics | ${score.completeModules} modules</span>
      </div>
      <strong class="leaderboard-points">${score.points} pts</strong>
    `;
    list.append(row);
  });
}

function renderFocusNext(todayIso, missed) {
  els.focusNext.innerHTML = `<div class="focus-list"></div>`;
  const list = els.focusNext.querySelector(".focus-list");
  const nextExam = state.subjects
    .filter((subject) => daysBetween(todayIso, subject.examDate) >= 0)
    .sort((a, b) => daysBetween(todayIso, a.examDate) - daysBetween(todayIso, b.examDate))[0];
  const weakestSubject = state.subjects
    .map((subject) => {
      const sessions = state.sessions.filter((session) => session.subjectId === subject.id);
      const complete = sessions.filter((session) => session.complete).length;
      const pct = sessions.length ? Math.round((complete / sessions.length) * 100) : 0;
      return { subject, pct };
    })
    .sort((a, b) => a.pct - b.pct)[0];

  const items = [
    nextExam && {
      color: nextExam.color,
      title: `${nextExam.name} is next`,
      detail: `${daysBetween(todayIso, nextExam.examDate)} days until ${formatDate(nextExam.examDate)}.`,
    },
    weakestSubject && {
      color: weakestSubject.subject.color,
      title: `Lowest completion: ${weakestSubject.subject.shortName}`,
      detail: `${weakestSubject.pct}% of planned sessions complete.`,
    },
    {
      color: missed.length ? "#b42318" : "#147d3f",
      title: missed.length ? "Catch-up recommended" : "No missed sessions",
      detail: missed.length
        ? `${missed.length} unfinished past session${missed.length === 1 ? "" : "s"} can be redistributed.`
        : "Your past sessions are clear.",
    },
  ].filter(Boolean);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "focus-row";
    row.style.setProperty("--subject-color", item.color);
    row.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span>`;
    list.append(row);
  });
}

function generateSessions(subjects) {
  const sessions = [];
  const cursors = Object.fromEntries(
    subjects.map((subject) => [
      subject.id,
      {
        topicIndex: 0,
        reviewIndex: 0,
        typeIndex: 0,
        stages: Object.fromEntries(subject.topics.map((topic) => [topic.id, 0])),
      },
    ]),
  );

  eachDate(PLAN_START, PLAN_END).forEach((date) => {
    const iso = toIso(date);
    if (date.getDay() === 0) return;

    const examSubject = subjects.find((subject) => subject.examDate === iso);
    if (examSubject) {
      sessions.push({
        id: makeId(),
        date: iso,
        start: "09:00",
        end: "10:30",
        duration: 90,
        subjectId: examSubject.id,
        topicId: examSubject.topics[0]?.id ?? "",
        type: "Light review",
        notes: `${examSubject.name} exam day. Keep this block for final formulae, checklists, and calm recall.`,
        complete: false,
        locked: false,
        exam: true,
      });
      return;
    }

    const eveSubject = subjects.find((subject) => daysBetween(iso, subject.examDate) === 1);
    if (eveSubject) {
      BLOCKS.forEach((block, index) => {
        sessions.push(makeGeneratedSession(eveSubject, cursors[eveSubject.id], iso, block, index, "Light review"));
      });
      return;
    }

    BLOCKS.forEach((block, index) => {
      const subject = pickSubject(subjects, iso, sessions, index);
      sessions.push(makeGeneratedSession(subject, cursors[subject.id], iso, block, index));
    });
  });

  return sessions;
}

function makeGeneratedSession(subject, cursor, date, block, blockIndex, forcedType) {
  const plan = forcedType
    ? makeReviewSessionPlan(subject, cursor, forcedType)
    : makeFlowSessionPlan(subject, cursor, date, blockIndex);

  return {
    id: makeId(),
    date,
    start: block.start,
    end: block.end,
    duration: block.duration,
    subjectId: subject.id,
    topicId: plan.topic?.id ?? "",
    type: plan.type,
    notes: "",
    complete: false,
    locked: false,
  };
}

function makeFlowSessionPlan(subject, cursor, date, blockIndex) {
  if (!subject.topics.length) return { topic: null, type: "Topic study" };

  const daysToExam = Math.max(0, daysBetween(date, subject.examDate));
  const closeToExam = daysToExam <= 10;
  const veryCloseToExam = daysToExam <= 5;
  const allStudied = subject.topics.every((topic) => getTopicStage(cursor, topic) >= 1);
  const allRecalled = subject.topics.every((topic) => getTopicStage(cursor, topic) >= 2);
  const allPracticed = subject.topics.every((topic) => getTopicStage(cursor, topic) >= 3);

  if (!allStudied) {
    return advanceTopicStage(subject, cursor, 0);
  }

  if (!allRecalled && (closeToExam || blockIndex > 0)) {
    return advanceTopicStage(subject, cursor, 1);
  }

  if (!allPracticed && (veryCloseToExam || allRecalled || blockIndex > 1)) {
    return advanceTopicStage(subject, cursor, 2);
  }

  if (!allRecalled) {
    return advanceTopicStage(subject, cursor, 1);
  }

  if (!allPracticed) {
    return advanceTopicStage(subject, cursor, 2);
  }

  return makeReviewSessionPlan(subject, cursor, closeToExam ? rotatingActiveType(cursor) : "Past-paper practice");
}

function makeReviewSessionPlan(subject, cursor, type) {
  if (!subject.topics.length) return { topic: null, type };
  const topic = subject.topics[cursor.reviewIndex % subject.topics.length];
  cursor.reviewIndex += 1;
  return { topic, type };
}

function advanceTopicStage(subject, cursor, stage) {
  const topic = findNextTopicAtStage(subject, cursor, stage);
  cursor.stages[topic.id] = stage + 1;
  cursor.topicIndex = (subject.topics.findIndex((item) => item.id === topic.id) + 1) % subject.topics.length;
  return { topic, type: TOPIC_FLOW[stage] };
}

function findNextTopicAtStage(subject, cursor, stage) {
  for (let offset = 0; offset < subject.topics.length; offset += 1) {
    const topic = subject.topics[(cursor.topicIndex + offset) % subject.topics.length];
    if (getTopicStage(cursor, topic) === stage) return topic;
  }

  return subject.topics[cursor.topicIndex % subject.topics.length];
}

function getTopicStage(cursor, topic) {
  if (!(topic.id in cursor.stages)) cursor.stages[topic.id] = 0;
  return cursor.stages[topic.id];
}

function rotatingActiveType(cursor) {
  const types = ["Active recall", "Practice questions", "Past-paper practice"];
  const type = types[cursor.typeIndex % types.length];
  cursor.typeIndex += 1;
  return type;
}

function pickSubject(subjects, dateIso, existingSessions, blockIndex) {
  const available = subjects.filter((subject) => daysBetween(dateIso, subject.examDate) >= 0);
  const scheduledMinutes = Object.fromEntries(subjects.map((subject) => [subject.id, 0]));

  existingSessions.forEach((session) => {
    scheduledMinutes[session.subjectId] = (scheduledMinutes[session.subjectId] || 0) + Number(session.duration || 90);
  });

  return available
    .map((subject) => {
      const daysToExam = Math.max(1, daysBetween(dateIso, subject.examDate));
      const urgency = 1 + 26 / daysToExam;
      const firstExamBoost = subject.id === "am" && dateIso < subject.examDate ? 1.35 : 1;
      const target = subject.credits * urgency * firstExamBoost * 100;
      const current = scheduledMinutes[subject.id] || 0;
      const rotationNudge = subject.id === subjects[blockIndex % subjects.length]?.id ? 10 : 0;
      return { subject, score: target - current + rotationNudge };
    })
    .sort((a, b) => b.score - a.score)[0].subject;
}

function renderCountdowns() {
  els.countdowns.innerHTML = "";
  const todayIso = getStudyTodayIso();
  [...state.subjects].sort((a, b) => a.examDate.localeCompare(b.examDate)).forEach((subject) => {
    const days = daysBetween(todayIso, subject.examDate);
    const card = document.createElement("div");
    card.className = "countdown";
    card.style.setProperty("--subject-color", subject.color);
    card.innerHTML = `
      <strong>${subject.name}</strong>
      <span>${formatDate(subject.examDate)} - ${days} days - ${subject.credits} credits</span>
    `;
    els.countdowns.append(card);
  });
}

function renderCalendar() {
  const filter = els.subjectFilter.value;
  els.calendar.innerHTML = "";

  eachDate(PLAN_START, PLAN_END).forEach((date) => {
    const iso = toIso(date);
    const day = document.createElement("article");
    day.className = "day-card";
    day.innerHTML = `
      <div class="day-head">
        <h3>${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</h3>
        <span>${iso}</span>
      </div>
    `;

    const examSubject = state.subjects.find((subject) => subject.examDate === iso);
    if (date.getDay() === 0) {
      day.insertAdjacentHTML("beforeend", `<div class="free-day">Day off</div>`);
    } else if (examSubject) {
      const color = examSubject.color;
      const exam = document.createElement("div");
      exam.className = "exam-day";
      exam.style.setProperty("--subject-color", color);
      exam.textContent = `${examSubject.name} exam. Light recall only.`;
      day.append(exam);
      appendSessions(day, iso, filter);
    } else {
      appendSessions(day, iso, filter);
    }

    els.calendar.append(day);
  });
}

function renderCalendarEditor() {
  const visibleDays = Number(els.calendarRange.value || 7);
  calendarEditorStart = clampIsoDate(calendarEditorStart, PLAN_START, addDays(PLAN_END, -(visibleDays - 1)));
  els.calendarStart.value = calendarEditorStart;
  els.calendarEditor.innerHTML = "";
  els.calendarEditor.classList.toggle("range-day", visibleDays === 1);
  els.calendarEditor.classList.toggle("range-week", visibleDays === 7);
  els.calendarEditor.classList.toggle("range-fortnight", visibleDays === 14);
  els.calendarEditor.style.setProperty("--editor-days", String(visibleDays));
  els.calendarEditor.style.setProperty("--editor-day-height", `${(DAY_END_MINUTES - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`);

  const timeRail = document.createElement("div");
  timeRail.className = "calendar-time-rail";
  timeRail.innerHTML = `<div class="calendar-day-title">Time</div>`;
  for (let minutes = DAY_START_MINUTES; minutes <= DAY_END_MINUTES; minutes += 60) {
    const tick = document.createElement("div");
    tick.className = "calendar-time-tick";
    tick.style.top = `${(minutes - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`;
    tick.textContent = minutesToTime(minutes);
    timeRail.append(tick);
  }
  els.calendarEditor.append(timeRail);

  eachDate(calendarEditorStart, addDays(calendarEditorStart, visibleDays - 1)).forEach((date) => {
    const iso = toIso(date);
    const day = document.createElement("div");
    day.className = "calendar-edit-day";
    day.dataset.date = iso;
    const dayName = visibleDays === 14
      ? date.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 1)
      : date.toLocaleDateString("en-GB", { weekday: "short" });
    const dateLabel = visibleDays === 14
      ? String(date.getDate())
      : formatTinyDate(iso);
    day.innerHTML = `
      <div class="calendar-day-title">
        <strong>${dayName}</strong>
        <span>${dateLabel}</span>
      </div>
      <div class="calendar-day-grid"></div>
    `;
    const grid = day.querySelector(".calendar-day-grid");

    for (let minutes = DAY_START_MINUTES; minutes <= DAY_END_MINUTES; minutes += 60) {
      const line = document.createElement("div");
      line.className = "calendar-hour-line";
      line.style.top = `${(minutes - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`;
      grid.append(line);
    }

    state.sessions
      .filter((session) => session.date === iso)
      .sort(compareSessionTime)
      .forEach((session) => grid.append(renderCalendarEditorSession(session)));

    els.calendarEditor.append(day);
  });
}

function renderCalendarEditorSession(session) {
  const subject = getSubject(session.subjectId);
  const topic = getTopic(session.subjectId, session.topicId);
  const start = timeToMinutes(session.start);
  const duration = Number(session.duration || minutesBetween(session.start, session.end));
  const card = document.createElement("div");
  card.className = `calendar-edit-session${session.complete ? " complete" : ""}`;
  card.dataset.sessionId = session.id;
  card.style.setProperty("--subject-color", subject.color);
  card.style.top = `${Math.max(0, start - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`;
  card.style.height = `${Math.max(30, duration * CALENDAR_PIXELS_PER_MINUTE)}px`;
  card.innerHTML = `
    <div class="calendar-session-body" data-drag-handle="move">
      <strong>${session.start}-${session.end} ${subject.shortName}</strong>
      <span>${escapeHtml(topic?.title || "Custom topic")}</span>
    </div>
    <button class="calendar-resize-handle" type="button" data-drag-handle="resize" aria-label="Resize session"></button>
  `;

  card.querySelector("[data-drag-handle='move']").addEventListener("pointerdown", (event) => startCalendarDrag(event, session, "move"));
  card.querySelector("[data-drag-handle='resize']").addEventListener("pointerdown", (event) => startCalendarDrag(event, session, "resize"));
  card.addEventListener("dblclick", () => openSessionDialog(session));
  return card;
}

function startCalendarDrag(event, session, mode) {
  if (event.button !== 0) return;
  const card = event.currentTarget.closest(".calendar-edit-session");
  const grid = card.closest(".calendar-day-grid");
  const day = card.closest(".calendar-edit-day");
  calendarDrag = {
    mode,
    session,
    pointerId: event.pointerId,
    startY: event.clientY,
    startMinutes: timeToMinutes(session.start),
    duration: Number(session.duration || minutesBetween(session.start, session.end)),
    sourceDate: session.date,
    dayWidth: day.getBoundingClientRect().width,
    gridTop: grid.getBoundingClientRect().top,
  };
  card.setPointerCapture(event.pointerId);
  card.classList.add("dragging");
  card.addEventListener("pointermove", handleCalendarDragMove);
  card.addEventListener("pointerup", finishCalendarDrag);
  card.addEventListener("pointercancel", finishCalendarDrag);
  event.preventDefault();
}

function handleCalendarDragMove(event) {
  if (!calendarDrag) return;
  const card = event.currentTarget;
  const deltaMinutes = snapMinutes((event.clientY - calendarDrag.startY) / CALENDAR_PIXELS_PER_MINUTE);

  if (calendarDrag.mode === "resize") {
    const duration = clampMinutes(calendarDrag.duration + deltaMinutes, 30, DAY_END_MINUTES - calendarDrag.startMinutes);
    card.style.height = `${duration * CALENDAR_PIXELS_PER_MINUTE}px`;
    return;
  }

  const nextStart = clampMinutes(calendarDrag.startMinutes + deltaMinutes, DAY_START_MINUTES, DAY_END_MINUTES - calendarDrag.duration);
  card.style.top = `${(nextStart - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`;
}

function finishCalendarDrag(event) {
  if (!calendarDrag) return;
  const card = event.currentTarget;
  const deltaMinutes = snapMinutes((event.clientY - calendarDrag.startY) / CALENDAR_PIXELS_PER_MINUTE);

  if (calendarDrag.mode === "resize") {
    const duration = clampMinutes(calendarDrag.duration + deltaMinutes, 30, DAY_END_MINUTES - calendarDrag.startMinutes);
    calendarDrag.session.duration = duration;
    calendarDrag.session.end = minutesToTime(calendarDrag.startMinutes + duration);
  } else {
    const nextStart = clampMinutes(calendarDrag.startMinutes + deltaMinutes, DAY_START_MINUTES, DAY_END_MINUTES - calendarDrag.duration);
    const targetDate = getCalendarDateFromPoint(event.clientX) || calendarDrag.sourceDate;
    calendarDrag.session.date = targetDate;
    calendarDrag.session.start = minutesToTime(nextStart);
    calendarDrag.session.end = minutesToTime(nextStart + calendarDrag.duration);
  }

  card.classList.remove("dragging");
  card.releasePointerCapture(calendarDrag.pointerId);
  card.removeEventListener("pointermove", handleCalendarDragMove);
  card.removeEventListener("pointerup", finishCalendarDrag);
  card.removeEventListener("pointercancel", finishCalendarDrag);
  calendarDrag = null;
  markDirtyAndSave();
  render();
}

function getCalendarDateFromPoint(clientX) {
  const days = [...els.calendarEditor.querySelectorAll(".calendar-edit-day")];
  const target = days.find((day) => {
    const rect = day.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right;
  });
  return target?.dataset.date;
}

function handleCalendarStartChange() {
  calendarEditorStart = clampIsoDate(els.calendarStart.value || PLAN_START, PLAN_START, PLAN_END);
  renderCalendarEditor();
}

function shiftCalendarEditor(direction) {
  const visibleDays = Number(els.calendarRange.value || 7);
  calendarEditorStart = addDays(calendarEditorStart, direction * visibleDays);
  renderCalendarEditor();
}

function appendSessions(day, iso, filter) {
  const wrapper = document.createElement("div");
  wrapper.className = "sessions";

  const sessions = state.sessions
    .filter((session) => session.date === iso)
    .filter((session) => filter === "all" || session.subjectId === filter)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!sessions.length) {
    wrapper.innerHTML = `<div class="free-day">No scheduled sessions for this filter.</div>`;
  }

  sessions.forEach((session) => wrapper.append(renderSession(session)));
  day.append(wrapper);
}

function renderSession(session) {
  const subject = getSubject(session.subjectId);
  const topic = getTopic(session.subjectId, session.topicId);
  const card = document.createElement("div");
  card.className = `session${session.complete ? " complete" : ""}`;
  card.style.setProperty("--subject-color", subject.color);

  card.innerHTML = `
    <div class="session-time">${session.start}-${session.end} (${session.duration} min)</div>
    <div class="session-subject">${subject.name}</div>
    <div class="session-topic">${topic?.title || "Custom topic"}</div>
    <div class="session-type">${session.type}</div>
    ${session.notes ? `<p>${escapeHtml(session.notes)}</p>` : ""}
    <div class="session-actions">
      <label class="check">
        <input type="checkbox" ${session.complete ? "checked" : ""} data-action="complete" />
        Done
      </label>
      <button type="button" data-action="edit">Edit</button>
    </div>
  `;

  card.querySelector("[data-action='complete']").addEventListener("change", (event) => {
    session.complete = event.target.checked;
    updateTopicCompletionFromSessions(session);
    markDirtyAndSave();
    render();
  });

  card.querySelector("[data-action='edit']").addEventListener("click", () => openSessionDialog(session));
  return card;
}

function renderTopics() {
  els.topicGrid.innerHTML = "";

  state.subjects.forEach((subject) => {
    const card = document.createElement("article");
    card.className = "subject-card";
    card.style.setProperty("--subject-color", subject.color);
    card.innerHTML = `<h3>${subject.name}</h3>`;

    const list = document.createElement("div");
    list.className = "topic-list";
    subject.topics.forEach((topic) => {
      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML = `
        <input type="checkbox" ${topic.complete ? "checked" : ""} aria-label="Mark ${escapeAttr(topic.title)} complete" />
        <input type="text" value="${escapeAttr(topic.title)}" />
        <button type="button" aria-label="Delete topic">x</button>
      `;
      row.querySelector("input[type='checkbox']").addEventListener("change", (event) => {
        topic.complete = event.target.checked;
        markDirtyAndSave();
        renderProgress();
      });
      row.querySelector("input[type='text']").addEventListener("change", (event) => {
        topic.title = event.target.value.trim() || topic.title;
        markDirtyAndSave();
        render();
      });
      row.querySelector("button").addEventListener("click", () => {
        subject.topics = subject.topics.filter((item) => item.id !== topic.id);
        state.sessions = state.sessions.filter((session) => session.topicId !== topic.id);
        markDirtyAndSave();
        render();
      });
      list.append(row);
    });

    const add = document.createElement("div");
    add.className = "topic-add";
    add.innerHTML = `
      <input type="text" placeholder="New topic" />
      <button type="button">Add</button>
    `;
    add.querySelector("button").addEventListener("click", () => {
      const input = add.querySelector("input");
      const title = input.value.trim();
      if (!title) return;
      subject.topics.push({ id: makeId(), title, complete: false });
      input.value = "";
      markDirtyAndSave();
      render();
    });

    card.append(list, add);
    els.topicGrid.append(card);
  });
}

function renderProgress() {
  els.progressGrid.innerHTML = "";
  renderGanttChart();

  state.subjects.forEach((subject) => {
    const sessions = state.sessions.filter((session) => session.subjectId === subject.id);
    const completeSessions = sessions.filter((session) => session.complete).length;
    const completedTopics = subject.topics.filter((topic) => topic.complete).length;
    const sessionPct = sessions.length ? Math.round((completeSessions / sessions.length) * 100) : 0;
    const topicPct = subject.topics.length ? Math.round((completedTopics / subject.topics.length) * 100) : 0;

    const card = document.createElement("article");
    card.className = "progress-card";
    card.style.setProperty("--subject-color", subject.color);
    card.innerHTML = `
      <h3>${subject.name}</h3>
      <div class="stat-line"><span>Sessions complete</span><strong>${completeSessions}/${sessions.length}</strong></div>
      <div class="meter" aria-label="${sessionPct}% sessions complete"><span style="--value:${sessionPct}%"></span></div>
      <div class="stat-line"><span>Topics complete</span><strong>${completedTopics}/${subject.topics.length}</strong></div>
      <div class="meter" aria-label="${topicPct}% topics complete"><span style="--value:${topicPct}%"></span></div>
      <div class="topic-progress"></div>
    `;

    const topicProgress = card.querySelector(".topic-progress");
    subject.topics.forEach((topic) => {
      const related = sessions.filter((session) => session.topicId === topic.id);
      const done = related.filter((session) => session.complete).length;
      const line = document.createElement("div");
      line.className = "stat-line";
      line.innerHTML = `<span>${escapeHtml(topic.title)}</span><strong>${done}/${related.length}</strong>`;
      topicProgress.append(line);
    });

    els.progressGrid.append(card);
  });
}

function renderGanttChart() {
  if (els.ganttPanel.classList.contains("collapsed")) return;

  const totalDays = daysBetween(PLAN_START, PLAN_END) + 1;
  const visibleDays = Number(els.ganttRange.value || 14);
  const maxOffset = Math.max(0, totalDays - visibleDays);
  ganttStartOffset = Math.min(ganttStartOffset, maxOffset);

  const windowStart = addDays(PLAN_START, ganttStartOffset);
  const windowEnd = addDays(windowStart, visibleDays - 1);
  const dateWindow = eachDate(windowStart, windowEnd).map(toIso);
  const todayIso = getStudyTodayIso();
  els.ganttWindowLabel.textContent = `${formatShortDate(windowStart)} to ${formatShortDate(windowEnd)}`;
  els.ganttChart.innerHTML = "";
  els.ganttChart.style.setProperty("--gantt-days", String(dateWindow.length));

  const header = document.createElement("div");
  header.className = "gantt-row gantt-date-row";
  header.innerHTML = `<div class="gantt-label"></div>${dateWindow
    .map((date) => `<div class="gantt-date${date === todayIso ? " today-marker" : ""}">${formatGanttHeaderDate(date)}</div>`)
    .join("")}`;
  els.ganttChart.append(header);

  state.subjects.forEach((subject) => {
    const subjectRow = document.createElement("div");
    subjectRow.className = "gantt-subject-row";
    subjectRow.style.setProperty("--subject-color", subject.color);
    subjectRow.textContent = subject.name;
    els.ganttChart.append(subjectRow);

    subject.topics.forEach((topic) => {
      const row = document.createElement("div");
      row.className = "gantt-row";
      row.style.setProperty("--subject-color", subject.color);
      row.innerHTML = `<div class="gantt-label">${escapeHtml(topic.title)}</div>`;

      dateWindow.forEach((date) => {
        const cell = document.createElement("div");
        cell.className = `gantt-cell${date === todayIso ? " today-marker" : ""}`;
        const sessions = state.sessions
          .filter((session) => session.subjectId === subject.id && session.topicId === topic.id && session.date === date)
          .sort((a, b) => a.start.localeCompare(b.start));

        sessions.forEach((session) => {
          const bar = document.createElement("button");
          bar.className = `gantt-bar${session.complete ? " complete" : ""}`;
          bar.type = "button";
          bar.title = `${session.start}-${session.end}: ${session.type}`;
          bar.textContent = getGanttBarLabel(session);
          bar.addEventListener("click", () => openSessionDialog(session));
          cell.append(bar);
        });

        row.append(cell);
      });

      els.ganttChart.append(row);
    });
  });
}

function handleGanttRangeChange() {
  const visibleDays = Number(els.ganttRange.value || 14);
  const todayOffset = Math.max(0, daysBetween(PLAN_START, getStudyTodayIso()));
  ganttStartOffset = Math.max(0, Math.min(todayOffset, daysBetween(PLAN_START, PLAN_END) + 1 - visibleDays));
  renderGanttChart();
}

function toggleGanttPanel() {
  const isOpening = els.ganttPanel.classList.contains("collapsed");
  els.ganttPanel.classList.toggle("collapsed", !isOpening);
  els.ganttToggle.setAttribute("aria-expanded", String(isOpening));
  els.ganttToggleText.textContent = isOpening ? "Hide chart" : "Show chart";
  renderGanttChart();
}

function getGanttBarLabel(session) {
  if (session.type === "Topic study") return "Study";
  if (session.type === "Active recall") return "Recall";
  if (session.type === "Practice questions") return "Qs";
  if (session.type === "Past-paper practice") return "Paper";
  return "Review";
}

function openSessionDialog(session = null) {
  els.dialogTitle.textContent = session ? "Edit session" : "Add session";
  els.sessionId.value = session?.id || "";
  els.sessionDate.value = session?.date || PLAN_START;
  els.sessionSubject.value = session?.subjectId || state.subjects[0].id;
  populateTopicSelect(els.sessionSubject.value);
  els.sessionTopic.value = session?.topicId || els.sessionTopic.options[0]?.value || "";
  els.sessionTime.value = session?.start || BLOCKS[0].start;
  els.sessionType.value = session?.type || "Topic study";
  els.sessionDuration.value = String(session?.duration || 90);
  els.sessionNotes.value = session?.notes || "";
  els.deleteSessionBtn.style.display = session ? "block" : "none";
  els.dialog.showModal();
}

function populateTopicSelect(subjectId) {
  const subject = getSubject(subjectId);
  els.sessionTopic.innerHTML = "";
  subject.topics.forEach((topic) => {
    els.sessionTopic.append(new Option(topic.title, topic.id));
  });
}

function handleSessionSubmit(event) {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    els.dialog.close();
    return;
  }

  const block = BLOCKS.find((item) => item.start === els.sessionTime.value) || BLOCKS[0];
  const duration = Number(els.sessionDuration.value);
  const payload = {
    id: els.sessionId.value || makeId(),
    date: els.sessionDate.value,
    start: block.start,
    end: minutesToTime(timeToMinutes(block.start) + duration),
    duration,
    subjectId: els.sessionSubject.value,
    topicId: els.sessionTopic.value,
    type: els.sessionType.value,
    notes: els.sessionNotes.value.trim(),
    complete: false,
    locked: false,
  };

  const existing = state.sessions.find((session) => session.id === payload.id);
  if (existing) {
    Object.assign(existing, payload, { complete: existing.complete });
  } else {
    state.sessions.push(payload);
  }

  els.dialog.close();
  markDirtyAndSave();
  render();
}

function deleteCurrentSession() {
  const id = els.sessionId.value;
  if (!id) return;
  state.sessions = state.sessions.filter((session) => session.id !== id);
  els.dialog.close();
  markDirtyAndSave();
  render();
}

function openRestructureDialog() {
  els.restructureText.value = "";
  els.copyRestructureState.textContent = "";
  updateRestructurePrompt();
  els.restructureDialog.showModal();
}

function updateRestructurePrompt() {
  const request = els.restructureText.value.trim();
  const outOfScope = getOutOfScopeTerms(request);
  els.restructureWarning.hidden = outOfScope.length === 0;
  els.restructureWarning.textContent = outOfScope.length
    ? `This sounds like it may affect the website/interface: ${outOfScope.join(", ")}. Keep this request limited to timetable, modules, topics, and sessions.`
    : "";
  els.restructurePrompt.value = buildRestructurePrompt(request);
}

async function copyRestructurePrompt() {
  updateRestructurePrompt();
  try {
    await navigator.clipboard.writeText(els.restructurePrompt.value);
    els.copyRestructureState.textContent = "Copied";
  } catch {
    els.restructurePrompt.select();
    els.copyRestructureState.textContent = "Select and copy";
  }
}

function buildRestructurePrompt(request) {
  const profile = getActiveProfile();
  const sessions = state.sessions
    .sort(compareSessionTime)
    .map((session) => {
      const subject = getSubject(session.subjectId);
      const topic = getTopic(session.subjectId, session.topicId);
      return {
        id: session.id,
        date: session.date,
        start: session.start,
        end: session.end,
        duration: session.duration,
        subject: subject.name,
        topic: topic?.title || "Custom topic",
        type: session.type,
        complete: session.complete,
      };
    });
  const modules = state.subjects.map((subject) => ({
    name: subject.name,
    credits: subject.credits,
    examDate: subject.examDate,
    topics: subject.topics.map((topic) => ({
      title: topic.title,
      complete: topic.complete,
    })),
  }));

  return [
    "Please restructure my revision timetable app data only.",
    "Scope: change timetable sessions, modules, topics, session timing, session duration, session types, and completion-aware scheduling only. Do not change website styling, layout, controls, theme, tabs, or interface code unless I explicitly ask outside this restructure request.",
    "",
    `Active profile: ${profile.name}`,
    `User restructure request: ${request || "[write the requested timetable/module/session changes here]"}`,
    "",
    "Current modules/topics:",
    JSON.stringify(modules, null, 2),
    "",
    "Current sessions:",
    JSON.stringify(sessions, null, 2),
  ].join("\n");
}

function getOutOfScopeTerms(request) {
  const terms = ["style", "theme", "dark mode", "light mode", "interface", "website", "layout", "button", "tab", "dashboard", "css", "font", "colour", "color"];
  const normalised = request.toLowerCase();
  return terms.filter((term) => normalised.includes(term));
}

function reorganiseCatchUpPlan() {
  if (!window.confirm("Reorganise this profile's missed sessions into future available blocks? Completed sessions will be kept.")) return;

  const todayIso = getStudyTodayIso();
  const missed = getMissedSessions(state, todayIso);

  if (!missed.length) {
    els.saveState.textContent = "No catch-up needed";
    window.setTimeout(renderProfileTitle, 1200);
    return;
  }

  const completed = state.sessions.filter((session) => session.complete || isProtectedSession(session));
  const futureFlexible = state.sessions
    .filter((session) => !session.complete && !isProtectedSession(session) && session.date >= todayIso)
    .sort(compareSessionTime);

  if (!futureFlexible.length) {
    els.saveState.textContent = "No future blocks available";
    window.setTimeout(renderProfileTitle, 1400);
    return;
  }

  const pastMissedIds = new Set(missed.map((session) => session.id));
  const catchUpQueue = [...missed, ...futureFlexible.filter((session) => !pastMissedIds.has(session.id))]
    .sort((a, b) => {
      const missedDelta = Number(pastMissedIds.has(b.id)) - Number(pastMissedIds.has(a.id));
      if (missedDelta) return missedDelta;
      return getSessionUrgencyScore(b, todayIso) - getSessionUrgencyScore(a, todayIso);
    });

  const futureSlots = futureFlexible.map((session) => ({
    date: session.date,
    start: session.start,
    end: session.end,
    duration: session.duration,
  }));
  const rebuilt = [];

  futureSlots.forEach((slot, index) => {
    const queued = catchUpQueue[index];
    if (!queued) return;
    rebuilt.push({
      ...queued,
      id: makeId(),
      date: slot.date,
      start: slot.start,
      end: slot.end,
      duration: slot.duration,
      complete: false,
      notes: pastMissedIds.has(queued.id)
        ? addCatchUpNote(queued.notes)
        : queued.notes,
    });
  });

  state.sessions = [...completed, ...rebuilt].sort(compareSessionTime);
  markDirtyAndSave();
  render();
  els.saveState.textContent = `Moved ${Math.min(missed.length, futureSlots.length)} missed session${missed.length === 1 ? "" : "s"}`;
}

function regeneratePlan() {
  if (!window.confirm("Regenerate this profile's timetable from the current topics and scheduling rules? Manual session edits may be replaced.")) return;

  const completedByTopic = new Map();
  state.sessions.forEach((session) => {
    if (session.complete) completedByTopic.set(session.topicId, true);
  });
  state.sessions = generateSessions(state.subjects);
  state.scheduleVersion = SCHEDULE_VERSION;
  state.subjects.forEach((subject) => {
    subject.topics.forEach((topic) => {
      topic.complete = Boolean(topic.complete || completedByTopic.get(topic.id));
    });
  });
  markDirtyAndSave();
  render();
}

function getMissedSessions(profileState, todayIso) {
  return profileState.sessions
    .filter((session) => !session.complete && !isProtectedSession(session, profileState) && session.date < todayIso)
    .sort(compareSessionTime);
}

function isProtectedSession(session, profileState = state) {
  if (session.exam) return true;
  const subject = profileState.subjects.find((item) => item.id === session.subjectId);
  return Boolean(subject && session.type === "Light review" && daysBetween(session.date, subject.examDate) === 1);
}

function getSessionUrgencyScore(session, todayIso) {
  const subject = state.subjects.find((item) => item.id === session.subjectId);
  if (!subject) return 0;
  const daysToExam = Math.max(1, daysBetween(todayIso, subject.examDate));
  const typeWeight = session.type === "Topic study" ? 8 : session.type === "Active recall" ? 12 : 16;
  return subject.credits * 12 + typeWeight + 90 / daysToExam;
}

function addCatchUpNote(notes) {
  const catchUpText = "Catch-up session moved from an earlier missed block.";
  if (!notes) return catchUpText;
  if (notes.includes(catchUpText)) return notes;
  return `${catchUpText} ${notes}`;
}

function getProfileMetrics(profileState) {
  const totalSessions = profileState.sessions.length;
  const completeSessions = profileState.sessions.filter((session) => session.complete).length;
  const totalTopics = profileState.subjects.reduce((sum, subject) => sum + subject.topics.length, 0);
  const completeTopics = profileState.subjects.reduce(
    (sum, subject) => sum + subject.topics.filter((topic) => topic.complete).length,
    0,
  );
  const todayIso = getStudyTodayIso();
  const upcomingSessions = profileState.sessions.filter((session) => !session.complete && session.date >= todayIso).length;

  return {
    totalSessions,
    completeSessions,
    totalTopics,
    completeTopics,
    upcomingSessions,
    sessionPct: totalSessions ? Math.round((completeSessions / totalSessions) * 100) : 0,
    topicPct: totalTopics ? Math.round((completeTopics / totalTopics) * 100) : 0,
  };
}

function getProfileScore(profileState) {
  const completeSessions = profileState.sessions.filter((session) => session.complete).length;
  const completeTopics = profileState.subjects.reduce(
    (sum, subject) => sum + subject.topics.filter((topic) => topic.complete).length,
    0,
  );
  const completeModules = profileState.subjects.filter(
    (subject) => subject.topics.length > 0 && subject.topics.every((topic) => topic.complete),
  ).length;

  return {
    completeSessions,
    completeTopics,
    completeModules,
    points:
      completeSessions * POINTS.session +
      completeTopics * POINTS.topic +
      completeModules * POINTS.module,
  };
}

function resetAll() {
  if (!window.confirm(`Reset ${getActiveProfile().name}'s timetable, topics, and progress to the original plan?`)) return;
  state = makeDefaultState();
  appState.profiles[appState.activeProfile] = state;
  markDirtyAndSave();
  render();
}

function updateTopicCompletionFromSessions(session) {
  const topic = getTopic(session.subjectId, session.topicId);
  if (!topic) return;
  const related = state.sessions.filter((item) => item.topicId === topic.id);
  topic.complete = related.length > 0 && related.every((item) => item.complete);
}

function getSubject(subjectId) {
  return state.subjects.find((subject) => subject.id === subjectId) || state.subjects[0];
}

function getTopic(subjectId, topicId) {
  return getSubject(subjectId).topics.find((topic) => topic.id === topicId);
}

function eachDate(startIso, endIso) {
  const dates = [];
  const current = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getStudyTodayIso() {
  const today = new Date();
  const todayIso = toIso(today);
  if (todayIso < PLAN_START) return PLAN_START;
  if (todayIso > PLAN_END) return PLAN_END;
  return todayIso;
}

function addDays(iso, amount) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toIso(date);
}

function clampIsoDate(iso, minIso, maxIso) {
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

function compareSessionTime(a, b) {
  return `${a.date}-${a.start}`.localeCompare(`${b.date}-${b.start}`);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesBetween(start, end) {
  return timeToMinutes(end) - timeToMinutes(start);
}

function snapMinutes(minutes) {
  return Math.round(minutes / CALENDAR_STEP_MINUTES) * CALENDAR_STEP_MINUTES;
}

function clampMinutes(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.round((end - start) / 86400000);
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatShortDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatTinyDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatGanttHeaderDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `<span>${weekday}</span><strong>${day}</strong>`;
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
