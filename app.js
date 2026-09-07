import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const USERS = {
  seongbae: { id: "seongbae", name: "SB" },
  lovely: { id: "lovely", name: "YJ" },
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const STORAGE_KEY = "lovelygirl-checkin-v1";
const PROFILE_KEY = "lovelygirl-active-user";

const FATIGUE_TIPS = [
  {
    min: 1,
    max: 2,
    emoji: "😊",
    title: "가벼운 아침이에요",
    body: "컨디션이 좋아요. 좋아하는 음악이나 짧은 산책으로 기분 좋게 시작해 보세요.",
  },
  {
    min: 3,
    max: 4,
    emoji: "🙂",
    title: "괜찮아요",
    body: "가벼운 스트레칭과 따뜻한 차로 몸을 풀어주면 회복에 도움이 돼요.",
  },
  {
    min: 5,
    max: 6,
    emoji: "😐",
    title: "조금 피곤하네요",
    body: "쉴 때 눈을 감고 호흡을 고르거나, 짧은 휴식으로 페이스를 조절해 보세요.",
  },
  {
    min: 7,
    max: 8,
    emoji: "😣",
    title: "피로가 쌓였어요",
    body: "따뜻한 물, 목·어깨 스트레칭, 오늘은 무리하지 않는 스케줄을 추천해요.",
  },
  {
    min: 9,
    max: 10,
    emoji: "😫",
    title: "많이 지쳤네요",
    body: "오늘은 휴식 우선. 따뜻한 물·수면·아주 가벼운 스트레칭이 회복에 좋아요.",
  },
];

const TIME_OPTIONS = buildTimeOptions();

const cloudEnabled =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabase = null;
let weekOffset = 0;
let activeUser = localStorage.getItem(PROFILE_KEY) || "seongbae";
let state = loadLocalState();
let saveTimer = null;
let pendingFatigue = 5;
let fatigueEditing = true;

const els = {
  weekTitle: document.getElementById("week-title"),
  todayChip: document.getElementById("today-chip"),
  attendanceGrid: document.getElementById("attendance-grid"),
  workoutBoards: document.getElementById("workout-boards"),
  shareSummary: document.getElementById("share-summary"),
  workoutForm: document.getElementById("workout-form"),
  workoutDate: document.getElementById("workout-date"),
  workoutType: document.getElementById("workout-type"),
  workoutMinutes: document.getElementById("workout-minutes"),
  workoutNote: document.getElementById("workout-note"),
  syncStatus: document.getElementById("sync-status"),
  setupPanel: document.getElementById("setup-panel"),
  footerNote: document.getElementById("footer-note"),
  whoBtns: [...document.querySelectorAll(".who-btn")],
  fatigueFaces: document.getElementById("fatigue-faces"),
  fatiguePick: document.getElementById("fatigue-pick"),
  fatigueResult: document.getElementById("fatigue-result"),
  fatigueEmoji: document.getElementById("fatigue-emoji"),
  fatigueTipTitle: document.getElementById("fatigue-tip-title"),
  fatigueTipBody: document.getElementById("fatigue-tip-body"),
  fatigueSave: document.getElementById("fatigue-save"),
  fatigueEdit: document.getElementById("fatigue-edit"),
  fatiguePartner: document.getElementById("fatigue-partner"),
};

function buildTimeOptions() {
  const options = [];
  for (let h = 6; h <= 23; h += 1) {
    for (let m = 0; m < 60; m += 5) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options.push(value);
    }
  }
  return options;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attendance: {}, workouts: [], fatigue: {} };
    const parsed = JSON.parse(raw);
    return {
      attendance: parsed.attendance || {},
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      fatigue: parsed.fatigue || {},
    };
  } catch {
    return { attendance: {}, workouts: [], fatigue: {} };
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setSyncStatus(mode, text) {
  els.syncStatus.dataset.state = mode;
  els.syncStatus.textContent = text;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getWeekDates() {
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(base, i));
}

function getWeekdays(weekDates) {
  return weekDates.filter((d) => {
    const day = d.getDay();
    return day >= 1 && day <= 5;
  });
}

function attendanceId(userId, date) {
  return `${userId}_${date}`;
}

function fatigueId(userId, date) {
  return `${userId}_${date}`;
}

function partnerId(userId) {
  return userId === "seongbae" ? "lovely" : "seongbae";
}

function getAttendance(userId, date) {
  return state.attendance[attendanceId(userId, date)] || null;
}

function getFatigue(userId, date) {
  return state.fatigue[fatigueId(userId, date)] || null;
}

function getFatigueTip(level) {
  return FATIGUE_TIPS.find((t) => level >= t.min && level <= t.max) || FATIGUE_TIPS[2];
}

function weekWorkouts(userId, weekDates) {
  const set = new Set(weekDates.map(formatDate));
  return state.workouts
    .filter((w) => w.userId === userId && set.has(w.date))
    .sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)
    );
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function timeSelectHtml(field, date, value) {
  const options = TIME_OPTIONS.map(
    (t) => `<option value="${t}" ${t === value ? "selected" : ""}>${t}</option>`
  ).join("");
  return `
    <select class="time-select" data-time-field="${field}" data-date="${date}">
      <option value="">—</option>
      ${options}
    </select>
  `;
}

async function initCloud() {
  if (!cloudEnabled) {
    setSyncStatus("local", "이 기기만 저장");
    els.setupPanel.hidden = false;
    els.footerNote.textContent = "SB × YJ · 클라우드 연결 전이라 이 기기에만 저장돼요";
    return;
  }

  setSyncStatus("syncing", "클라우드 연결 중…");
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    await refreshFromCloud();
    subscribeRealtime();
    setSyncStatus("cloud", "클라우드 동기화 중");
    els.setupPanel.hidden = true;
    els.footerNote.textContent = "SB × YJ · 기록이 클라우드에 저장되어 어디서든 공유돼요";
  } catch (err) {
    console.error(err);
    setSyncStatus("error", "클라우드 연결 실패 · 로컬 사용");
    els.setupPanel.hidden = false;
    els.footerNote.textContent = "SB × YJ · 연결에 문제가 있어 이 기기 저장으로 동작 중";
  }
}

async function refreshFromCloud() {
  if (!supabase) return;

  const weekDates = getWeekDates();
  const from = formatDate(weekDates[0]);
  const to = formatDate(weekDates[6]);
  const today = formatDate(new Date());

  const [attRes, workRes, fatRes] = await Promise.all([
    supabase.from("attendance").select("*").gte("date", from).lte("date", to),
    supabase.from("workouts").select("*").gte("date", from).lte("date", to).order("created_at", {
      ascending: false,
    }),
    supabase.from("fatigue").select("*").eq("date", today),
  ]);

  if (attRes.error) throw attRes.error;
  if (workRes.error) throw workRes.error;
  if (fatRes.error) console.warn("fatigue sync skipped:", fatRes.error.message);

  for (const row of attRes.data || []) {
    state.attendance[row.id] = {
      id: row.id,
      userId: row.user_id,
      date: row.date,
      clockIn: row.clock_in,
      clockOut: row.clock_out,
      updatedAt: row.updated_at,
    };
  }

  const remoteIds = new Set((workRes.data || []).map((r) => r.id));
  state.workouts = [
    ...(workRes.data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: row.date,
      type: row.type,
      minutes: row.minutes,
      note: row.note || "",
      createdAt: row.created_at,
    })),
    ...state.workouts.filter((w) => !remoteIds.has(w.id) && !(w.date >= from && w.date <= to)),
  ];

  for (const row of fatRes.data || []) {
    state.fatigue[row.id] = {
      id: row.id,
      userId: row.user_id,
      date: row.date,
      level: row.level,
      updatedAt: row.updated_at,
    };
  }

  persistLocal();
  render();
}

function subscribeRealtime() {
  if (!supabase) return;

  supabase
    .channel("sb-yj-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attendance" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          delete state.attendance[payload.old.id];
        } else {
          const row = payload.new;
          state.attendance[row.id] = {
            id: row.id,
            userId: row.user_id,
            date: row.date,
            clockIn: row.clock_in,
            clockOut: row.clock_out,
            updatedAt: row.updated_at,
          };
        }
        persistLocal();
        renderAttendance(getWeekDates());
        renderSummary(getWeekDates());
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workouts" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          state.workouts = state.workouts.filter((w) => w.id !== payload.old.id);
        } else if (payload.eventType === "INSERT") {
          const row = payload.new;
          if (!state.workouts.some((w) => w.id === row.id)) {
            state.workouts.unshift({
              id: row.id,
              userId: row.user_id,
              date: row.date,
              type: row.type,
              minutes: row.minutes,
              note: row.note || "",
              createdAt: row.created_at,
            });
          }
        } else {
          const row = payload.new;
          state.workouts = state.workouts.map((w) =>
            w.id === row.id
              ? {
                  id: row.id,
                  userId: row.user_id,
                  date: row.date,
                  type: row.type,
                  minutes: row.minutes,
                  note: row.note || "",
                  createdAt: row.created_at,
                }
              : w
          );
        }
        persistLocal();
        renderWorkouts(getWeekDates());
        renderSummary(getWeekDates());
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fatigue" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          delete state.fatigue[payload.old.id];
        } else {
          const row = payload.new;
          state.fatigue[row.id] = {
            id: row.id,
            userId: row.user_id,
            date: row.date,
            level: row.level,
            updatedAt: row.updated_at,
          };
        }
        persistLocal();
        renderFatigue();
      }
    )
    .subscribe();
}

async function upsertAttendance(record) {
  state.attendance[record.id] = record;
  persistLocal();
  renderAttendance(getWeekDates());
  renderSummary(getWeekDates());

  if (!supabase) return;
  setSyncStatus("syncing", "저장 중…");
  const { error } = await supabase.from("attendance").upsert({
    id: record.id,
    user_id: record.userId,
    date: record.date,
    clock_in: record.clockIn,
    clock_out: record.clockOut,
    updated_at: record.updatedAt,
  });
  if (error) {
    console.error(error);
    setSyncStatus("error", "저장 실패 · 로컬에만 반영");
  } else {
    setSyncStatus("cloud", "클라우드 동기화 중");
  }
}

async function upsertFatigue(record) {
  state.fatigue[record.id] = record;
  persistLocal();
  renderFatigue();

  if (!supabase) return;
  setSyncStatus("syncing", "저장 중…");
  const { error } = await supabase.from("fatigue").upsert({
    id: record.id,
    user_id: record.userId,
    date: record.date,
    level: record.level,
    updated_at: record.updatedAt,
  });
  if (error) {
    console.error(error);
    setSyncStatus("error", "저장 실패 · 로컬에만 반영");
  } else {
    setSyncStatus("cloud", "클라우드 동기화 중");
  }
}

async function insertWorkout(record) {
  state.workouts.unshift(record);
  persistLocal();
  renderWorkouts(getWeekDates());
  renderSummary(getWeekDates());

  if (!supabase) return;
  setSyncStatus("syncing", "저장 중…");
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      id: record.id,
      user_id: record.userId,
      date: record.date,
      type: record.type,
      minutes: record.minutes,
      note: record.note,
      created_at: record.createdAt,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    setSyncStatus("error", "저장 실패 · 로컬에만 반영");
    return;
  }

  if (data?.id && data.id !== record.id) {
    state.workouts = state.workouts.map((w) =>
      w.id === record.id ? { ...w, id: data.id, createdAt: data.created_at } : w
    );
    persistLocal();
    renderWorkouts(getWeekDates());
  }
  setSyncStatus("cloud", "클라우드 동기화 중");
}

async function removeWorkout(id) {
  state.workouts = state.workouts.filter((w) => w.id !== id);
  persistLocal();
  renderWorkouts(getWeekDates());
  renderSummary(getWeekDates());

  if (!supabase) return;
  setSyncStatus("syncing", "삭제 중…");
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) {
    console.error(error);
    setSyncStatus("error", "삭제 실패");
  } else {
    setSyncStatus("cloud", "클라우드 동기화 중");
  }
}

function queueCloudRefresh() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (supabase) refreshFromCloud().catch(console.error);
  }, 200);
}

function applyTheme() {
  document.body.dataset.user = activeUser;
}

function renderWho() {
  applyTheme();
  els.whoBtns.forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.who === activeUser));
  });
}

function renderWeekTitle(weekDates) {
  const start = weekDates[0];
  const end = weekDates[6];
  const sameMonth = start.getMonth() === end.getMonth();
  const label = sameMonth
    ? `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일–${end.getDate()}일`
    : `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;

  els.weekTitle.textContent = weekOffset === 0 ? "이번 주" : label;
  els.todayChip.textContent = `오늘날짜 : ${formatDisplayDate(new Date())}`;
}

function renderFatigueFaces() {
  els.fatigueFaces.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const level = i + 1;
    const tip = getFatigueTip(level);
    const pressed = pendingFatigue === level;
    return `
      <button
        type="button"
        class="fatigue-face-btn"
        data-level="${level}"
        aria-pressed="${pressed}"
        title="피로도 ${level}"
      >
        <span class="face">${tip.emoji}</span>
        <span class="num">${level}</span>
      </button>
    `;
  }).join("");
}

function renderFatigue() {
  const today = formatDate(new Date());
  const mine = getFatigue(activeUser, today);
  const partner = partnerId(activeUser);
  const theirs = getFatigue(partner, today);

  const showResult = Boolean(mine) && !fatigueEditing;

  if (showResult) {
    const tip = getFatigueTip(mine.level);
    els.fatiguePick.hidden = true;
    els.fatigueResult.hidden = false;
    els.fatigueEmoji.textContent = tip.emoji;
    els.fatigueTipTitle.textContent = `피로도 ${mine.level} · ${tip.title}`;
    els.fatigueTipBody.textContent = tip.body;
  } else {
    els.fatiguePick.hidden = false;
    els.fatigueResult.hidden = true;
    renderFatigueFaces();
    els.fatigueSave.disabled = false;
  }

  if (theirs) {
    const tip = getFatigueTip(theirs.level);
    els.fatiguePartner.innerHTML = `
      <div class="fatigue-partner-card">
        <span class="fatigue-partner-emoji">${tip.emoji}</span>
        <div>
          <strong>${USERS[partner].name} 아침 피로도 ${theirs.level}</strong>
          <p>${tip.title}</p>
        </div>
      </div>
    `;
  } else {
    els.fatiguePartner.innerHTML = `
      <p class="fatigue-partner-empty">${USERS[partner].name}의 오늘 아침 피로도는 아직 없어요.</p>
    `;
  }
}

function renderAttendance(weekDates) {
  const today = formatDate(new Date());
  const partner = partnerId(activeUser);
  const weekdays = getWeekdays(weekDates);

  els.attendanceGrid.innerHTML = weekdays
    .map((dateObj) => {
      const date = formatDate(dateObj);
      const mine = getAttendance(activeUser, date);
      const theirs = getAttendance(partner, date);
      const isToday = date === today;
      const clockIn = mine?.clockIn || "";
      const clockOut = mine?.clockOut || "";

      return `
        <article class="day-card ${isToday ? "is-today" : ""}">
          <div class="day-label">
            <strong>${DAY_LABELS[dateObj.getDay()]}</strong>
            <span>${dateObj.getMonth() + 1}/${dateObj.getDate()}</span>
          </div>
          <label class="time-row">
            <span class="label">출근</span>
            ${timeSelectHtml("in", date, clockIn)}
          </label>
          <label class="time-row">
            <span class="label">퇴근</span>
            ${timeSelectHtml("out", date, clockOut)}
          </label>
          <div class="partner-peek">
            <span>${USERS[partner].name}</span>
            <strong>${theirs?.clockIn || "—"} / ${theirs?.clockOut || "—"}</strong>
          </div>
          <button
            type="button"
            class="day-action secondary"
            data-action="clear"
            data-date="${date}"
            ${!clockIn && !clockOut ? "disabled" : ""}
          >지우기</button>
        </article>
      `;
    })
    .join("");
}

function renderWorkouts(weekDates) {
  els.workoutBoards.innerHTML = Object.values(USERS)
    .map((user) => {
      const items = weekWorkouts(user.id, weekDates);
      const list =
        items.length === 0
          ? `<p class="empty-hint">아직 기록이 없어요.</p>`
          : `<ul class="workout-list">${items
              .map((w) => {
                const canDelete = w.userId === activeUser;
                const mins = w.minutes ? `${w.minutes}분` : "";
                return `
                  <li class="workout-item">
                    <div>
                      <div class="title">${escapeHtml(w.type)}${mins ? ` · ${mins}` : ""}</div>
                      <div class="meta">${w.date.slice(5).replace("-", "/")}${
                        w.note ? ` · ${escapeHtml(w.note)}` : ""
                      }</div>
                    </div>
                    ${
                      canDelete
                        ? `<button type="button" class="icon-btn" data-delete-workout="${w.id}" aria-label="삭제">×</button>`
                        : ""
                    }
                  </li>
                `;
              })
              .join("")}</ul>`;

      return `
        <section class="board" data-user="${user.id}">
          <h3>${user.name}</h3>
          ${list}
        </section>
      `;
    })
    .join("");
}

function renderSummary(weekDates) {
  const weekdays = getWeekdays(weekDates);
  els.shareSummary.innerHTML = Object.values(USERS)
    .map((user) => {
      const days = weekdays.filter((d) => getAttendance(user.id, formatDate(d))?.clockIn).length;
      const outs = weekdays.filter((d) => getAttendance(user.id, formatDate(d))?.clockOut).length;
      const workouts = weekWorkouts(user.id, weekDates);
      const minutes = workouts.reduce((sum, w) => sum + (Number(w.minutes) || 0), 0);

      return `
        <article class="summary-card" data-user="${user.id}">
          <h3>${user.name}</h3>
          <div class="stat-row"><span>출근한 날</span><span>${days}일</span></div>
          <div class="stat-row"><span>퇴근 기록</span><span>${outs}일</span></div>
          <div class="stat-row"><span>운동 횟수</span><span>${workouts.length}회</span></div>
          <div class="stat-row"><span>운동 시간</span><span>${minutes}분</span></div>
        </article>
      `;
    })
    .join("");
}

function render() {
  const weekDates = getWeekDates();
  renderWho();
  renderWeekTitle(weekDates);
  renderFatigue();
  renderAttendance(weekDates);
  renderWorkouts(weekDates);
  renderSummary(weekDates);
}

async function handleTimeChange(date, field, value) {
  const id = attendanceId(activeUser, date);
  const current = getAttendance(activeUser, date) || {
    id,
    userId: activeUser,
    date,
    clockIn: null,
    clockOut: null,
  };

  if (field === "in") current.clockIn = value || null;
  else current.clockOut = value || null;
  current.updatedAt = new Date().toISOString();

  if (!current.clockIn && !current.clockOut) {
    delete state.attendance[id];
    persistLocal();
    renderAttendance(getWeekDates());
    renderSummary(getWeekDates());
    if (supabase) {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) {
        console.error(error);
        setSyncStatus("error", "삭제 실패");
      }
    }
    return;
  }

  await upsertAttendance(current);
}

async function handleClear(date) {
  const id = attendanceId(activeUser, date);
  delete state.attendance[id];
  persistLocal();
  renderAttendance(getWeekDates());
  renderSummary(getWeekDates());

  if (!supabase) return;
  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) {
    console.error(error);
    setSyncStatus("error", "삭제 실패");
  }
}

async function saveFatigue() {
  const today = formatDate(new Date());
  const level = pendingFatigue;
  const id = fatigueId(activeUser, today);
  fatigueEditing = false;
  await upsertFatigue({
    id,
    userId: activeUser,
    date: today,
    level,
    updatedAt: new Date().toISOString(),
  });
}

function bindEvents() {
  els.whoBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeUser = btn.dataset.who;
      localStorage.setItem(PROFILE_KEY, activeUser);
      const today = formatDate(new Date());
      const mine = getFatigue(activeUser, today);
      pendingFatigue = mine?.level ?? 5;
      fatigueEditing = !mine;
      render();
    });
  });

  document.getElementById("prev-week").addEventListener("click", () => {
    weekOffset -= 1;
    render();
    queueCloudRefresh();
  });
  document.getElementById("next-week").addEventListener("click", () => {
    weekOffset += 1;
    render();
    queueCloudRefresh();
  });
  document.getElementById("this-week").addEventListener("click", () => {
    weekOffset = 0;
    render();
    queueCloudRefresh();
  });

  els.attendanceGrid.addEventListener("change", (event) => {
    const select = event.target.closest(".time-select");
    if (!select) return;
    handleTimeChange(select.dataset.date, select.dataset.timeField, select.value);
  });

  els.attendanceGrid.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='clear']");
    if (!btn || btn.disabled) return;
    handleClear(btn.dataset.date);
  });

  els.workoutBoards.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-delete-workout]");
    if (!btn) return;
    removeWorkout(btn.dataset.deleteWorkout);
  });

  els.workoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const record = {
      id: crypto.randomUUID(),
      userId: activeUser,
      date: els.workoutDate.value,
      type: els.workoutType.value,
      minutes: els.workoutMinutes.value ? Number(els.workoutMinutes.value) : null,
      note: els.workoutNote.value.trim(),
      createdAt: new Date().toISOString(),
    };
    await insertWorkout(record);
    els.workoutNote.value = "";
    els.workoutMinutes.value = "";
  });

  els.fatigueFaces.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-level]");
    if (!btn) return;
    pendingFatigue = Number(btn.dataset.level);
    renderFatigueFaces();
    els.fatigueSave.disabled = false;
  });

  els.fatigueSave.addEventListener("click", () => {
    saveFatigue();
  });

  els.fatigueEdit.addEventListener("click", () => {
    const today = formatDate(new Date());
    const mine = getFatigue(activeUser, today);
    pendingFatigue = mine?.level ?? 5;
    fatigueEditing = true;
    renderFatigue();
  });
}

function boot() {
  els.workoutDate.value = formatDate(new Date());
  const today = formatDate(new Date());
  const mine = getFatigue(activeUser, today);
  pendingFatigue = mine?.level ?? 5;
  fatigueEditing = !mine;
  applyTheme();
  bindEvents();
  render();
  initCloud();
}

boot();
