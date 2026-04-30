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
  { id: "alex", name: "Alex" },
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
    examTime: "09:00",
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
    examTime: "09:00",
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
    examTime: "09:00",
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

const ALEX_SUBJECTS = [
  {
    id: "se",
    name: "Systems Engineering",
    shortName: "SE",
    credits: 5,
    color: "#c2410c",
    examDate: "2026-05-20",
    examTime: "09:00",
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
  {
    id: "avionics",
    name: "Avionic Systems",
    shortName: "Avionics",
    credits: 5,
    color: "#2563eb",
    examDate: "2026-06-04",
    examTime: "09:00",
    topics: [
      "Avionic Systems placeholder topic 1",
      "Avionic Systems placeholder topic 2",
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
let openExamEditorSubjectId = null;
let editingStudySessionId = null;
let sessionContextMenu = null;
let studyTimer = {
  active: false,
  paused: false,
  startedAt: null,
  pausedAt: null,
  elapsedPausedMs: 0,
  intervalId: null,
};

const els = {
  saveState: document.querySelector("#saveState"),
  studyStartBtn: document.querySelector("#studyStartBtn"),
  studyActive: document.querySelector("#studyActive"),
  studyTimer: document.querySelector("#studyTimer"),
  studyPauseBtn: document.querySelector("#studyPauseBtn"),
  studyFinishBtn: document.querySelector("#studyFinishBtn"),
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
  studyDialog: document.querySelector("#studyDialog"),
  studyForm: document.querySelector("#studyForm"),
  studyDialogDuration: document.querySelector("#studyDialogDuration"),
  studySummary: document.querySelector("#studySummary"),
  studyStartHour: document.querySelector("#studyStartHour"),
  studyStartMinute: document.querySelector("#studyStartMinute"),
  studyEndHour: document.querySelector("#studyEndHour"),
  studyEndMinute: document.querySelector("#studyEndMinute"),
  studyEntryList: document.querySelector("#studyEntryList"),
  addStudyEntryBtn: document.querySelector("#addStudyEntryBtn"),
  cancelStudySessionBtn: document.querySelector("#cancelStudySessionBtn"),
  studySubmitState: document.querySelector("#studySubmitState"),
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

function makeDefaultState(profileId = "default") {
  const subjects = getDefaultSubjectsForProfile(profileId).map((subject) => ({
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

function getDefaultSubjectsForProfile(profileId) {
  return profileId === "alex" ? ALEX_SUBJECTS : SUBJECTS;
}

function makeDefaultAppState() {
  return {
    activeProfile: "christian",
    profiles: Object.fromEntries(PROFILES.map((profile) => [profile.id, makeDefaultState(profile.id)])),
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
    next.profiles[profile.id] = normaliseProfileState(parsed.profiles[profile.id], profile.id);
  });

  return next;
}

function migrateSingleProfileState(parsed) {
  const next = makeDefaultAppState();
  next.profiles.christian = normaliseProfileState(parsed, "christian");
  next.activeProfile = "christian";
  return next;
}

function normaliseProfileState(profileState, profileId = "default") {
  if (!profileState?.subjects || !profileState?.sessions) return makeDefaultState(profileId);
  profileState.subjects.forEach((subject) => {
    subject.examTime = subject.examTime || "09:00";
  });
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
  if (calendarDrag || els.dialog.open || els.restructureDialog.open || els.studyDialog.open) return;

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
    appState.profiles[row.id] = normaliseProfileState(row.data, row.id);
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

  renderSubjectControls();

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
  els.studyStartBtn.addEventListener("click", startStudyMode);
  els.studyPauseBtn.addEventListener("click", toggleStudyPause);
  els.studyFinishBtn.addEventListener("click", openStudyFinishDialog);
  els.addStudyEntryBtn.addEventListener("click", () => appendStudyEntry());
  els.cancelStudySessionBtn.addEventListener("click", cancelStudySessionFromDialog);
  els.studyForm.addEventListener("submit", handleStudySubmit);
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
  document.addEventListener("click", hideSessionContextMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSessionContextMenu();
  });
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

function renderSubjectControls() {
  const selectedFilter = state.subjects.some((subject) => subject.id === els.subjectFilter.value)
    ? els.subjectFilter.value
    : "all";
  const selectedSubject = state.subjects.some((subject) => subject.id === els.sessionSubject.value)
    ? els.sessionSubject.value
    : state.subjects[0]?.id;

  els.subjectFilter.innerHTML = "";
  els.subjectFilter.append(new Option("All subjects", "all"));
  els.sessionSubject.innerHTML = "";

  state.subjects.forEach((subject) => {
    els.subjectFilter.append(new Option(subject.name, subject.id));
    els.sessionSubject.append(new Option(subject.name, subject.id));
  });

  els.subjectFilter.value = selectedFilter;
  els.sessionSubject.value = selectedSubject;
  populateTopicSelect(els.sessionSubject.value);
}

function startStudyMode() {
  const now = Date.now();
  studyTimer = {
    active: true,
    paused: false,
    startedAt: now,
    pausedAt: null,
    elapsedPausedMs: 0,
    intervalId: window.setInterval(updateStudyTimerDisplay, 1000),
  };
  els.studyStartBtn.hidden = true;
  els.studyActive.hidden = false;
  els.studyPauseBtn.textContent = "Pause";
  updateStudyTimerDisplay();
}

function toggleStudyPause() {
  if (!studyTimer.active) return;

  if (studyTimer.paused) {
    studyTimer.elapsedPausedMs += Date.now() - studyTimer.pausedAt;
    studyTimer.paused = false;
    studyTimer.pausedAt = null;
    studyTimer.intervalId = window.setInterval(updateStudyTimerDisplay, 1000);
    els.studyPauseBtn.textContent = "Pause";
  } else {
    studyTimer.paused = true;
    studyTimer.pausedAt = Date.now();
    window.clearInterval(studyTimer.intervalId);
    els.studyPauseBtn.textContent = "Resume";
  }

  updateStudyTimerDisplay();
}

function openStudyFinishDialog() {
  if (!studyTimer.active) return;
  if (!studyTimer.paused) toggleStudyPause();
  editingStudySessionId = null;
  els.studySummary.value = "";
  els.studySubmitState.textContent = "";
  els.studyEntryList.innerHTML = "";
  const elapsedMs = getStudyElapsedMs();
  const startedAt = new Date(studyTimer.startedAt);
  const endedAt = new Date(studyTimer.startedAt + elapsedMs);
  els.studyDialogDuration.textContent = `Timer: ${formatDuration(elapsedMs)}`;
  setStudyTimeFields(startedAt, endedAt);
  appendStudyEntry();
  els.studyDialog.showModal();
}

function handleStudySubmit(event) {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    els.studyDialog.close();
    if (editingStudySessionId) {
      editingStudySessionId = null;
    } else if (studyTimer.active && studyTimer.paused) {
      toggleStudyPause();
    }
    return;
  }

  const entries = collectStudyEntries();
  if (!entries.length) {
    els.studySubmitState.textContent = "Add at least one study item.";
    return;
  }
  const adjustedTimes = getAdjustedStudyTimes();
  if (!adjustedTimes) {
    els.studySubmitState.textContent = "Enter valid start and finish times.";
    return;
  }

  if (editingStudySessionId) {
    const affected = updateLoggedStudySession(editingStudySessionId, entries, adjustedTimes);
    editingStudySessionId = null;
    markStudyTopicsComplete(entries);
    refreshTopicCompletionForKeys(affected);
  } else {
    const elapsedMs = adjustedTimes.endedAt - adjustedTimes.startedAt;
    const session = makeLoggedStudySession(entries, elapsedMs, adjustedTimes.startedAt, adjustedTimes.endedAt);
    removeMatchedPlannedSessions(session, entries);
    state.sessions.push(session);
    state.sessions.sort(compareSessionTime);
    stopStudyMode();
    markStudyTopicsComplete(entries);
  }
  els.studyDialog.close();
  markDirtyAndSave();
  switchView("dashboard");
  render();
}

function cancelStudySessionFromDialog() {
  if (editingStudySessionId) {
    els.studyDialog.close();
    editingStudySessionId = null;
    return;
  }

  const confirmed = window.confirm("Cancel this revision session? The timer will be discarded and nothing will be logged.");
  if (!confirmed) return;

  els.studyDialog.close();
  stopStudyMode();
}

function appendStudyEntry(entry = {}) {
  const row = document.createElement("div");
  row.className = "study-entry";
  row.innerHTML = `
    <label>
      Module
      <select class="study-entry-subject" required></select>
    </label>
    <label>
      Topics
      <select class="study-entry-topics" multiple required></select>
    </label>
    <label>
      Type
      <select class="study-entry-type" required></select>
    </label>
    <label>
      Minutes
      <input class="study-entry-minutes" type="number" min="5" step="5" value="${entry.minutes || 60}" required>
    </label>
    <button class="study-entry-remove" type="button" aria-label="Remove study item">x</button>
  `;

  const subjectSelect = row.querySelector(".study-entry-subject");
  const topicSelect = row.querySelector(".study-entry-topics");
  const typeSelect = row.querySelector(".study-entry-type");

  state.subjects.forEach((subject) => subjectSelect.append(new Option(subject.name, subject.id)));
  SESSION_TYPES.forEach((type) => typeSelect.append(new Option(type, type)));
  subjectSelect.value = entry.subjectId || state.subjects[0]?.id || "";
  typeSelect.value = entry.type || "Topic study";

  const refreshTopics = () => {
    const selectedTopicIds = entry.topicIds || [...topicSelect.selectedOptions].map((option) => option.value);
    populateStudyTopicSelect(topicSelect, subjectSelect.value, selectedTopicIds);
  };
  subjectSelect.addEventListener("change", () => {
    entry.topicIds = [];
    refreshTopics();
  });
  refreshTopics();

  row.querySelector(".study-entry-remove").addEventListener("click", () => {
    if (els.studyEntryList.children.length > 1) row.remove();
  });

  els.studyEntryList.append(row);
}

function populateStudyTopicSelect(select, subjectId, selectedTopicIds = []) {
  const subject = getSubject(subjectId);
  select.innerHTML = "";
  subject.topics.forEach((topic) => {
    const option = new Option(topic.title, topic.id);
    option.selected = selectedTopicIds.includes(topic.id) || (!selectedTopicIds.length && select.options.length === 0);
    select.append(option);
  });
}

function collectStudyEntries() {
  return [...els.studyEntryList.querySelectorAll(".study-entry")]
    .map((row) => {
      const subjectId = row.querySelector(".study-entry-subject").value;
      const topicIds = [...row.querySelector(".study-entry-topics").selectedOptions].map((option) => option.value);
      const type = row.querySelector(".study-entry-type").value;
      const minutes = Number(row.querySelector(".study-entry-minutes").value);
      return { subjectId, topicIds, type, minutes };
    })
    .filter((entry) => entry.subjectId && entry.topicIds.length && entry.type && entry.minutes > 0);
}

function makeLoggedStudySession(entries, elapsedMs, startedAt, endedAt) {
  const primary = entries[0];
  const primaryTopicId = primary.topicIds[0];
  const actualMinutes = Math.max(1, Math.round(elapsedMs / 60000));
  const date = toIso(startedAt);
  return {
    id: makeId(),
    date,
    start: minutesToTime(startedAt.getHours() * 60 + startedAt.getMinutes()),
    end: minutesToTime(endedAt.getHours() * 60 + endedAt.getMinutes()),
    duration: actualMinutes,
    subjectId: primary.subjectId,
    topicId: primaryTopicId,
    type: primary.type,
    notes: els.studySummary.value.trim(),
    complete: true,
    locked: false,
    logged: true,
    studyLog: normaliseStudyLogEntries(entries),
    timerMinutes: actualMinutes,
  };
}

function updateLoggedStudySession(sessionId, entries, adjustedTimes) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return [];
  const affected = getStudyLogTopicKeys(session);
  const primary = entries[0];
  const duration = Math.max(1, Math.round((adjustedTimes.endedAt - adjustedTimes.startedAt) / 60000));
  session.date = toIso(adjustedTimes.startedAt);
  session.start = minutesToTime(adjustedTimes.startedAt.getHours() * 60 + adjustedTimes.startedAt.getMinutes());
  session.end = minutesToTime(adjustedTimes.endedAt.getHours() * 60 + adjustedTimes.endedAt.getMinutes());
  session.duration = duration;
  session.timerMinutes = duration;
  session.subjectId = primary.subjectId;
  session.topicId = primary.topicIds[0];
  session.type = primary.type;
  session.notes = els.studySummary.value.trim();
  session.studyLog = normaliseStudyLogEntries(entries);
  return [...affected, ...getStudyLogTopicKeys(session)];
}

function normaliseStudyLogEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    topicTitles: entry.topicIds.map((topicId) => getTopic(entry.subjectId, topicId)?.title || "Custom topic"),
    subjectName: getSubject(entry.subjectId).name,
  }));
}

function removeMatchedPlannedSessions(loggedSession, entries) {
  const matched = new Set();
  entries.forEach((entry) => {
    entry.topicIds.forEach((topicId) => {
      const session = state.sessions
        .filter((item) => (
          !item.complete &&
          !item.logged &&
          !item.exam &&
          item.date === loggedSession.date &&
          intervalsOverlap(item.start, item.end, loggedSession.start, loggedSession.end) &&
          item.subjectId === entry.subjectId &&
          item.topicId === topicId &&
          item.type === entry.type
        ))
        .sort(compareSessionTime)[0];
      if (session) matched.add(session.id);
    });
  });
  state.sessions = state.sessions.filter((session) => !matched.has(session.id));
}

function markStudyTopicsComplete(entries) {
  entries.forEach((entry) => {
    entry.topicIds.forEach((topicId) => {
      const topic = getTopic(entry.subjectId, topicId);
      if (topic) topic.complete = true;
    });
  });
}

function openLoggedStudyEditDialog(session) {
  hideSessionContextMenu();
  editingStudySessionId = session.id;
  els.studySummary.value = session.notes || "";
  els.studySubmitState.textContent = "";
  els.studyEntryList.innerHTML = "";
  els.studyDialogDuration.textContent = `Logged time: ${formatDuration((session.timerMinutes || session.duration || 0) * 60000)}`;
  setStudyTimeFields(
    new Date(`${session.date}T${session.start}:00`),
    new Date(`${session.date}T${session.end}:00`),
  );
  (session.studyLog || [{
    subjectId: session.subjectId,
    topicIds: [session.topicId],
    type: session.type,
    minutes: session.duration || 60,
  }]).forEach((entry) => appendStudyEntry(entry));
  els.studyDialog.showModal();
}

function deleteLoggedStudySession(session) {
  hideSessionContextMenu();
  const affected = getStudyLogTopicKeys(session);
  state.sessions = state.sessions.filter((item) => item.id !== session.id);
  refreshTopicCompletionForKeys(affected);
  markDirtyAndSave();
  render();
}

function getStudyLogTopicKeys(session) {
  const entries = session.studyLog?.length
    ? session.studyLog
    : [{ subjectId: session.subjectId, topicIds: [session.topicId] }];
  return entries.flatMap((entry) => entry.topicIds.map((topicId) => `${entry.subjectId}:${topicId}`));
}

function refreshTopicCompletionForKeys(keys) {
  [...new Set(keys)].forEach((key) => {
    const [subjectId, topicId] = key.split(":");
    const topic = getTopic(subjectId, topicId);
    if (!topic) return;
    topic.complete = state.sessions.some((session) => session.complete && sessionCoversTopic(session, subjectId, topicId));
  });
}

function sessionCoversTopic(session, subjectId, topicId) {
  if (session.subjectId === subjectId && session.topicId === topicId) return true;
  return Boolean(session.studyLog?.some((entry) => entry.subjectId === subjectId && entry.topicIds.includes(topicId)));
}

function stopStudyMode() {
  window.clearInterval(studyTimer.intervalId);
  studyTimer = {
    active: false,
    paused: false,
    startedAt: null,
    pausedAt: null,
    elapsedPausedMs: 0,
    intervalId: null,
  };
  els.studyStartBtn.hidden = false;
  els.studyActive.hidden = true;
  els.studyTimer.textContent = "00:00:00";
  els.studyPauseBtn.textContent = "Pause";
}

function updateStudyTimerDisplay() {
  els.studyTimer.textContent = formatDuration(getStudyElapsedMs());
}

function getStudyElapsedMs() {
  if (!studyTimer.active) return 0;
  const end = studyTimer.paused ? studyTimer.pausedAt : Date.now();
  return Math.max(0, end - studyTimer.startedAt - studyTimer.elapsedPausedMs);
}

function setStudyTimeFields(startedAt, endedAt) {
  els.studyStartHour.value = String(startedAt.getHours()).padStart(2, "0");
  els.studyStartMinute.value = String(startedAt.getMinutes()).padStart(2, "0");
  els.studyEndHour.value = String(endedAt.getHours()).padStart(2, "0");
  els.studyEndMinute.value = String(endedAt.getMinutes()).padStart(2, "0");
}

function getAdjustedStudyTimes() {
  const start = readTimePair(els.studyStartHour.value, els.studyStartMinute.value);
  const end = readTimePair(els.studyEndHour.value, els.studyEndMinute.value);
  if (!start || !end) return null;

  const baseDate = editingStudySessionId
    ? state.sessions.find((session) => session.id === editingStudySessionId)?.date
    : toIso(new Date(studyTimer.startedAt));
  const startedAt = new Date(`${baseDate}T${minutesToTime(start)}:00`);
  let endedAt = new Date(`${baseDate}T${minutesToTime(end)}:00`);
  if (endedAt <= startedAt) endedAt = new Date(endedAt.getTime() + 86400000);
  return { startedAt, endedAt };
}

function readTimePair(hourValue, minuteValue) {
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function switchProfile() {
  if (studyTimer.active) {
    els.profileSelect.value = appState.activeProfile;
    window.alert("Finish the current study timer before switching profiles.");
    return;
  }
  const previousProfile = appState.activeProfile;
  appState.profiles[appState.activeProfile] = state;
  appState.activeProfile = els.profileSelect.value;
  state = getActiveProfileState();
  renderSubjectControls();
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
    renderTodaySessions(todaySessions).forEach((item) => els.todayList.append(item));
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

function renderTodaySessions(todaySessions) {
  const groupedPlannedIds = new Set();
  const groups = todaySessions
    .filter((session) => session.logged)
    .map((logged) => {
      const planned = todaySessions
        .filter((session) => !session.logged && !session.complete && intervalsOverlap(session.start, session.end, logged.start, logged.end))
        .sort(compareSessionTime);
      planned.forEach((session) => groupedPlannedIds.add(session.id));
      return { type: "overlap", logged, planned, sortKey: planned[0]?.start < logged.start ? planned[0].start : logged.start };
    })
    .filter((group) => group.planned.length);

  const items = [
    ...todaySessions
      .filter((session) => !groupedPlannedIds.has(session.id) && !groups.some((group) => group.logged.id === session.id))
      .map((session) => ({ type: "session", session, sortKey: session.start })),
    ...groups,
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return items.map((item) => {
    if (item.type === "session") return renderMiniSession(item.session, { showCheckbox: !item.session.logged });
    return renderOverlapGroup(item.logged, item.planned);
  });
}

function renderOverlapGroup(logged, plannedSessions) {
  const group = document.createElement("div");
  group.className = "today-overlap-group";
  group.innerHTML = `
    <div class="overlap-column">
      <span class="overlap-label">Recommended</span>
    </div>
    <div class="overlap-column">
      <span class="overlap-label">Studied</span>
    </div>
  `;
  const columns = group.querySelectorAll(".overlap-column");
  plannedSessions.forEach((session) => {
    columns[0].append(renderMiniSession(session, { displaced: !loggedStudyCoversPlannedSession(logged, session) }));
  });
  columns[1].append(renderMiniSession(logged));
  return group;
}

function loggedStudyCoversPlannedSession(logged, planned) {
  return Boolean(logged.studyLog?.some((entry) => (
    entry.subjectId === planned.subjectId &&
    entry.type === planned.type &&
    entry.topicIds.includes(planned.topicId)
  )));
}

function renderMiniSession(session, options = {}) {
  const subject = getSubject(session.subjectId);
  const topic = getTopic(session.subjectId, session.topicId);
  const item = document.createElement("div");
  item.className = `mini-session${session.complete ? " complete" : ""}${session.logged ? " logged" : ""}${isSessionOverdue(session) ? " overdue" : ""}${options.displaced ? " displaced" : ""}`;
  item.style.setProperty("--subject-color", subject.color);
  const detail = session.logged
    ? getStudyLogSummary(session)
    : `${escapeHtml(topic?.title || "Custom topic")}${session.complete ? " - complete" : isSessionOverdue(session) ? " - not complete" : ""}`;
  item.innerHTML = `
    <div class="mini-session-main">
      <strong>${session.start}-${session.end} - ${session.logged ? "Study log" : `${subject.shortName}: ${escapeHtml(session.type)}`}</strong>
      <span>${detail}</span>
    </div>
    ${options.showCheckbox ? `
      <label class="mini-session-check">
        <input type="checkbox" ${session.complete ? "checked" : ""} aria-label="Mark session complete">
      </label>
    ` : ""}
  `;
  const checkbox = item.querySelector(".mini-session-check input");
  if (checkbox) {
    checkbox.addEventListener("change", (event) => {
      session.complete = event.target.checked;
      updateTopicCompletionFromSessions(session);
      markDirtyAndSave();
      render();
    });
  }
  item.addEventListener("contextmenu", (event) => showSessionContextMenu(event, session));
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
    row.style.setProperty("--subject-color", getProfileColor(profile.id));
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

function getProfileColor(profileId) {
  return {
    christian: "#1d4ed8",
    luca: "#0f766e",
    will: "#c2410c",
    alex: "#2563eb",
  }[profileId] || "#64748b";
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

  eachDate(PLAN_START, getScheduleEnd(subjects)).forEach((date) => {
    const iso = toIso(date);
    if (date.getDay() === 0) return;

    const examSubject = subjects.find((subject) => subject.examDate === iso);
    if (examSubject) {
      const examStart = examSubject.examTime || "09:00";
      sessions.push({
        id: makeId(),
        date: iso,
        start: examStart,
        end: minutesToTime(timeToMinutes(examStart) + 90),
        duration: 90,
        subjectId: examSubject.id,
        topicId: examSubject.topics[0]?.id ?? "",
        type: "Light review",
        notes: `${examSubject.name} exam day at ${examStart}. Keep this block for final formulae, checklists, and calm recall.`,
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
  [...state.subjects].sort((a, b) => `${a.examDate}-${a.examTime || "09:00"}`.localeCompare(`${b.examDate}-${b.examTime || "09:00"}`)).forEach((subject) => {
    const days = daysBetween(todayIso, subject.examDate);
    const isEditing = openExamEditorSubjectId === subject.id;
    const card = document.createElement("div");
    card.className = `countdown${isEditing ? " editing" : ""}`;
    card.style.setProperty("--subject-color", subject.color);
    card.innerHTML = `
      <button class="countdown-summary" type="button" aria-expanded="${isEditing}" data-subject-id="${escapeHtml(subject.id)}" data-tooltip="Open exam date and time editing for this module.">
        <strong>${subject.name}</strong>
        <span>${formatDate(subject.examDate)} at ${subject.examTime || "09:00"} - ${days} days - ${subject.credits} credits</span>
      </button>
      <form class="exam-editor${isEditing ? "" : " hidden"}" data-subject-id="${escapeHtml(subject.id)}">
        <label>
          Date
          <input type="date" name="examDate" value="${escapeHtml(subject.examDate)}" min="${PLAN_START}">
        </label>
        <label>
          Time
          <input type="time" name="examTime" value="${escapeHtml(subject.examTime || "09:00")}">
        </label>
        <button type="submit" data-tooltip="Save this exam date and time, then rebuild the timetable around it.">Update</button>
        <button type="button" class="ghost exam-editor-cancel">Cancel</button>
      </form>
    `;
    card.querySelector(".countdown-summary").addEventListener("click", () => {
      openExamEditorSubjectId = openExamEditorSubjectId === subject.id ? null : subject.id;
      renderCountdowns();
    });
    card.querySelector(".exam-editor").addEventListener("submit", handleExamEditorSubmit);
    card.querySelector(".exam-editor-cancel").addEventListener("click", () => {
      openExamEditorSubjectId = null;
      renderCountdowns();
    });
    els.countdowns.append(card);
  });
}

function handleExamEditorSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const subject = state.subjects.find((item) => item.id === form.dataset.subjectId);
  if (!subject) return;

  const nextDate = form.elements.examDate.value;
  const nextTime = form.elements.examTime.value || "09:00";
  if (!nextDate) return;
  if (nextDate === subject.examDate && nextTime === (subject.examTime || "09:00")) return;

  const confirmed = window.confirm(
    `Update ${subject.name} to ${formatDate(nextDate)} at ${nextTime} and regenerate this profile's timetable around the new exam date? Manual session edits may be replaced.`,
  );
  if (!confirmed) {
    form.elements.examDate.value = subject.examDate;
    form.elements.examTime.value = subject.examTime || "09:00";
    return;
  }

  subject.examDate = nextDate;
  subject.examTime = nextTime;
  openExamEditorSubjectId = null;
  regenerateSessionsFromCurrentSubjects();
  markDirtyAndSave();
  render();
}

function renderCalendar() {
  const filter = els.subjectFilter.value;
  els.calendar.innerHTML = "";

  eachDate(PLAN_START, getScheduleEnd()).forEach((date) => {
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
      exam.textContent = `${examSubject.name} exam at ${examSubject.examTime || "09:00"}. Light recall only.`;
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
  const scheduleEnd = getScheduleEnd();
  calendarEditorStart = clampIsoDate(calendarEditorStart, PLAN_START, addDays(scheduleEnd, -(visibleDays - 1)));
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

    const daySessions = state.sessions
      .filter((session) => session.date === iso)
      .sort(compareSessionTime);
    const laneOptions = getCalendarOverlapLaneOptions(daySessions);
    daySessions.forEach((session) => grid.append(renderCalendarEditorSession(session, laneOptions.get(session.id))));

    els.calendarEditor.append(day);
  });
}

function getCalendarOverlapLaneOptions(sessions) {
  const options = new Map();
  const loggedSessions = sessions.filter((session) => session.logged);
  const plannedSessions = sessions.filter((session) => !session.logged && !session.complete);

  loggedSessions.forEach((logged) => {
    const overlappingPlanned = plannedSessions.filter((planned) => intervalsOverlap(planned.start, planned.end, logged.start, logged.end));
    if (!overlappingPlanned.length) return;

    options.set(logged.id, { lane: "right" });
    overlappingPlanned.forEach((planned) => {
      options.set(planned.id, {
        lane: "left",
        displaced: !loggedStudyCoversPlannedSession(logged, planned),
      });
    });
  });

  return options;
}

function renderCalendarEditorSession(session, options = {}) {
  const subject = getSubject(session.subjectId);
  const topic = getTopic(session.subjectId, session.topicId);
  const start = timeToMinutes(session.start);
  const duration = Number(session.duration || minutesBetween(session.start, session.end));
  const card = document.createElement("div");
  card.className = `calendar-edit-session${session.complete ? " complete" : ""}${session.logged ? " logged" : ""}${isSessionOverdue(session) ? " overdue" : ""}${options?.lane ? ` compare-${options.lane}` : ""}${options?.displaced ? " displaced" : ""}`;
  card.dataset.sessionId = session.id;
  card.style.setProperty("--subject-color", subject.color);
  card.style.top = `${Math.max(0, start - DAY_START_MINUTES) * CALENDAR_PIXELS_PER_MINUTE}px`;
  card.style.height = `${Math.max(30, duration * CALENDAR_PIXELS_PER_MINUTE)}px`;
  card.innerHTML = `
    <div class="calendar-session-body" data-drag-handle="move">
      <strong>${session.start}-${session.end} ${subject.shortName}</strong>
      <span>${session.logged ? getStudyLogSummary(session) : escapeHtml(topic?.title || "Custom topic")}</span>
    </div>
    <button class="calendar-resize-handle" type="button" data-drag-handle="resize" aria-label="Resize session"></button>
  `;

  card.querySelector("[data-drag-handle='move']").addEventListener("pointerdown", (event) => startCalendarDrag(event, session, "move"));
  card.querySelector("[data-drag-handle='resize']").addEventListener("pointerdown", (event) => startCalendarDrag(event, session, "resize"));
  card.addEventListener("dblclick", () => openSessionDialog(session));
  card.addEventListener("contextmenu", (event) => showSessionContextMenu(event, session));
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
  calendarEditorStart = clampIsoDate(els.calendarStart.value || PLAN_START, PLAN_START, getScheduleEnd());
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
  card.className = `session${session.complete ? " complete" : ""}${session.logged ? " logged" : ""}${isSessionOverdue(session) ? " overdue" : ""}`;
  card.style.setProperty("--subject-color", subject.color);
  const topicText = session.logged ? getStudyLogSummary(session) : escapeHtml(topic?.title || "Custom topic");
  const typeText = session.logged ? `Logged study - ${session.timerMinutes || session.duration} min timed` : session.type;

  card.innerHTML = `
    <div class="session-time">${session.start}-${session.end} (${session.duration} min)</div>
    <div class="session-subject">${subject.name}</div>
    <div class="session-topic">${topicText}</div>
    <div class="session-type">${typeText}</div>
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
  card.addEventListener("contextmenu", (event) => showSessionContextMenu(event, session));
  return card;
}

function showSessionContextMenu(event, session) {
  event.preventDefault();
  event.stopPropagation();
  hideSessionContextMenu();

  sessionContextMenu = document.createElement("div");
  sessionContextMenu.className = "session-context-menu";
  sessionContextMenu.innerHTML = session.logged
    ? `
      <button type="button" data-action="edit">Edit study block</button>
      <button type="button" class="danger" data-action="delete">Delete study block</button>
    `
    : `
      <button type="button" data-action="edit">Edit session</button>
      <button type="button" class="danger" data-action="delete">Delete session</button>
    `;

  sessionContextMenu.querySelector("[data-action='edit']").addEventListener("click", () => {
    hideSessionContextMenu();
    if (session.logged) {
      openLoggedStudyEditDialog(session);
    } else {
      openSessionDialog(session);
    }
  });
  sessionContextMenu.querySelector("[data-action='delete']").addEventListener("click", () => {
    if (session.logged) {
      deleteLoggedStudySession(session);
    } else {
      deleteSession(session);
    }
  });
  document.body.append(sessionContextMenu);

  const rect = sessionContextMenu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - rect.width - 8);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - 8);
  sessionContextMenu.style.left = `${Math.max(8, left)}px`;
  sessionContextMenu.style.top = `${Math.max(8, top)}px`;
}

function hideSessionContextMenu() {
  sessionContextMenu?.remove();
  sessionContextMenu = null;
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

  const scheduleEnd = getScheduleEnd();
  const totalDays = daysBetween(PLAN_START, scheduleEnd) + 1;
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
  ganttStartOffset = Math.max(0, Math.min(todayOffset, daysBetween(PLAN_START, getScheduleEnd()) + 1 - visibleDays));
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
  deleteSessionById(id);
  els.dialog.close();
  markDirtyAndSave();
  render();
}

function deleteSession(session) {
  hideSessionContextMenu();
  deleteSessionById(session.id);
  markDirtyAndSave();
  render();
}

function deleteSessionById(id) {
  state.sessions = state.sessions.filter((session) => session.id !== id);
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
    .filter((session) => !session.complete && !isProtectedSession(session) && !isSessionOverdue(session, state, todayIso) && session.date >= todayIso)
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

  regenerateSessionsFromCurrentSubjects();
  markDirtyAndSave();
  render();
}

function regenerateSessionsFromCurrentSubjects() {
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
}

function getMissedSessions(profileState, todayIso) {
  return profileState.sessions
    .filter((session) => isSessionOverdue(session, profileState, todayIso))
    .sort(compareSessionTime);
}

function isSessionOverdue(session, profileState = state, todayIso = getStudyTodayIso()) {
  if (session.complete || session.logged || isProtectedSession(session, profileState)) return false;
  if (session.date < todayIso) return true;
  if (session.date > todayIso) return false;
  return getCurrentMinutesForSchedule() > timeToMinutes(session.end);
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
  const upcomingSessions = profileState.sessions.filter((session) => !session.complete && session.date >= todayIso && !isSessionOverdue(session, profileState, todayIso)).length;

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
  state = makeDefaultState(appState.activeProfile);
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

function getStudyLogSummary(session) {
  if (!session.studyLog?.length) return "Logged study session";
  return session.studyLog
    .map((entry) => {
      const topics = (entry.topicTitles || entry.topicIds.map((topicId) => getTopic(entry.subjectId, topicId)?.title || "Custom topic")).join(", ");
      return `${escapeHtml(entry.subjectName || getSubject(entry.subjectId).name)}: ${escapeHtml(entry.type)} on ${escapeHtml(topics)} (${entry.minutes} min)`;
    })
    .join(" | ");
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

function getScheduleEnd(subjects = state?.subjects) {
  const examDates = subjects?.map((subject) => subject.examDate).filter(Boolean) || [];
  return [PLAN_END, ...examDates].sort().at(-1);
}

function getStudyTodayIso() {
  const today = new Date();
  const todayIso = toIso(today);
  const scheduleEnd = getScheduleEnd();
  if (todayIso < PLAN_START) return PLAN_START;
  if (todayIso > scheduleEnd) return scheduleEnd;
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

function getCurrentMinutesForSchedule() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function intervalsOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
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

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
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
