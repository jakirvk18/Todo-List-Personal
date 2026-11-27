const STORAGE_KEY = "focusTrackerV3";

/* ---------- WEEKLY SCHEDULE ----------
   Keys follow Date.getDay(): 0 = Sunday ... 6 = Saturday.
   Edit names / durations (minutes) here. */

const DEFAULT_MINUTES = 120;

const SUBJECTS = {
    CO:    "Calculus and Optimization",
    PYDSA: "Python & DSA",
    LA:    "Linear Algebra",
    AI:    "Artificial Intelligence",
    ML:    "Machine Learning",
    PS:    "Probability and Statistics",
    DBMS:  "DBMS",
    DW:    "Data Warehousing",
    TEST:  "Test"
};

const WEEKLY_SCHEDULE = {
    0: [{ subject: "TEST",  duration: 180 }],                                   // Sunday
    1: [{ subject: "CO" },    { subject: "PYDSA" }],                            // Monday
    2: [{ subject: "LA" },    { subject: "AI" }],                               // Tuesday
    3: [{ subject: "LA" },    { subject: "ML" }],                               // Wednesday
    4: [{ subject: "PS" },    { subject: "ML" }],                               // Thursday
    5: [{ subject: "PS" },    { subject: "DBMS" }],                             // Friday
    6: [{ subject: "PS" },    { subject: "DW" }]                                // Saturday
};

const DAY_NAMES = [
    "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
    "THURSDAY", "FRIDAY", "SATURDAY"
];

/* Common tasks every day EXCEPT Sunday (Sunday is Test only) */
const DAILY_TASKS = [
    { name: "Aptitude", duration: 60 },
    { name: "PYQs",     duration: 120 }
];

function getDefaults() {
    return getDefaultsForDay(new Date().getDay());
}

function getDefaultsForDay(day) {
    const subjects = (WEEKLY_SCHEDULE[day] || []).map(item => ({
        name: SUBJECTS[item.subject],
        duration: item.duration || DEFAULT_MINUTES
    }));

    if (day === 0) return subjects;

    return subjects.concat(DAILY_TASKS.map(t => ({ ...t })));
}

function today() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function newState() {
    return {
        date: today(),
        seeded: false,
        tasks: [],
        activeId: null,
        lastTick: null,
        focusSeconds: 0,
        completedCount: 0
    };
}

function loadState() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (data && data.date === today() &&
            Array.isArray(data.tasks)) {

            data.focusSeconds = data.focusSeconds || 0;
            data.completedCount = data.completedCount || 0;

            return data;
        }
    } catch (e) {}

    return newState();
}

let state = loadState();

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    recordHistory();
}

/* ---------- STREAK HISTORY ----------
   habitLog = { start: "YYYY-MM-DD", days: { "YYYY-MM-DD": { done, total } } }
   done  = distinct default tasks completed that day
   total = number of default tasks planned for that day */

const HISTORY_KEY = "focusTrackerHistoryV1";

function loadHistory() {
    try {
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY));

        if (h && h.days && typeof h.days === "object") {
            if (!h.start) h.start = today();
            return h;
        }
    } catch (e) {}

    return { start: today(), days: {} };
}

let habitLog = loadHistory();

function recordHistory() {
    if (state.date !== today()) return;

    const planned = getDefaults().map(d => d.name.toLowerCase());

    const doneSet = new Set(
        state.tasks
            .filter(t => t.completed && isDefaultTask(t))
            .map(t => t.name.toLowerCase())
            .filter(n => planned.includes(n))
    );

    const entry = { done: doneSet.size, total: planned.length };
    const old = habitLog.days[state.date];

    if (old && old.done === entry.done && old.total === entry.total) return;

    habitLog.days[state.date] = entry;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(habitLog));

    renderStreak();
}

function dateKey(d) {
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function isFullDay(key) {
    const e = habitLog.days[key];
    return !!e && e.total > 0 && e.done >= e.total;
}

function calcStreaks() {
    const now = new Date();
    now.setHours(12, 0, 0, 0);

    /* current streak: today counts if done, otherwise start from yesterday */
    let current = 0;
    const cursor = new Date(now);

    if (!isFullDay(dateKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
    }

    while (isFullDay(dateKey(cursor))) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
    }

    /* best streak: longest run of consecutive complete days */
    const keys = Object.keys(habitLog.days).filter(isFullDay).sort();

    let best = 0;
    let run = 0;
    let prev = null;

    keys.forEach(k => {
        const d = new Date(k + "T12:00:00");

        if (prev) {
            const next = new Date(prev);
            next.setDate(next.getDate() + 1);
            run = dateKey(next) === k ? run + 1 : 1;
        } else {
            run = 1;
        }

        best = Math.max(best, run);
        prev = d;
    });

    return { current, best };
}

/* ---------- STREAK CALENDAR ---------- */

const MONTH_NAMES = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

function changeMonth(delta) {
    const now = new Date();
    const target = new Date(viewYear, viewMonth + delta, 1);

    if (target > new Date(now.getFullYear(), now.getMonth(), 1)) return;

    viewYear = target.getFullYear();
    viewMonth = target.getMonth();

    renderStreak();
}

function renderStreak() {
    const grid = document.getElementById("calGrid");
    if (!grid) return;

    grid.innerHTML = "";

    DOW.forEach(label => {
        const h = document.createElement("div");
        h.className = "cal-dow";
        h.textContent = label;
        grid.appendChild(h);
    });

    const todayKey = today();
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; /* Monday first */

    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("div");
        blank.className = "cal-cell blank";
        grid.appendChild(blank);
    }

    let monthComplete = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const key = dateKey(new Date(viewYear, viewMonth, day));
        const entry = habitLog.days[key];

        const cell = document.createElement("div");
        cell.className = "cal-cell";
        cell.textContent = day;

        if (isFullDay(key)) {
            cell.classList.add("done");
            monthComplete++;
        } else if (entry && entry.done > 0) {
            cell.classList.add("partial");
        } else if (key < todayKey && key >= habitLog.start) {
            cell.classList.add("missed");
        }

        if (key === todayKey) cell.classList.add("today");

        if (entry) {
            cell.title = entry.done + " / " + entry.total + " default tasks";
        }

        grid.appendChild(cell);
    }

    document.getElementById("calTitle").textContent =
        MONTH_NAMES[viewMonth] + " " + viewYear;

    const now = new Date();
    document.getElementById("calNext").disabled =
        viewYear === now.getFullYear() && viewMonth === now.getMonth();

    const streaks = calcStreaks();

    document.getElementById("curStreak").textContent = streaks.current;
    document.getElementById("bestStreak").textContent = streaks.best;
    document.getElementById("monthDone").textContent = monthComplete;
}

function formatTime(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [h, m, s]
        .map(v => String(v).padStart(2, "0"))
        .join(":");
}

function createTask(name, duration) {
    state.tasks.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: name,
        duration: duration,
        remaining: duration * 60,
        completed: false,
        isDefault: false
    });

    save();
    renderTasks();
}

/* A default task can only finish by its timer running out */

function isDefaultTask(task) {
    if (typeof task.isDefault === "boolean") return task.isDefault;

    /* tasks saved before the flag existed: match by name */
    return getDefaults()
        .map(d => d.name.toLowerCase())
        .includes(task.name.toLowerCase());
}

/* AUTO-LOAD TODAY'S DEFAULTS (once per day) */

function seedDefaults() {
    const existing = state.tasks.map(t => t.name.toLowerCase());

    getDefaults().forEach(item => {
        if (!existing.includes(item.name.toLowerCase())) {
            state.tasks.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                name: item.name,
                duration: item.duration,
                remaining: item.duration * 60,
                completed: false,
                isDefault: true
            });
        }
    });

    state.seeded = true;

    save();
    renderTasks();
}

/* TIMER ENGINE */

function updateTimer() {
    if (!state.activeId || !state.lastTick) return;

    const now = Date.now();

    const elapsed = Math.floor(
        (now - state.lastTick) / 1000
    );

    if (elapsed <= 0) return;

    const task = state.tasks.find(
        t => t.id === state.activeId
    );

    if (!task || task.completed) {
        state.activeId = null;
        state.lastTick = null;
        return;
    }

    const used = Math.min(elapsed, task.remaining);

    task.remaining -= used;
    state.focusSeconds += used;
    state.lastTick += used * 1000;

    if (task.remaining <= 0) {
        task.remaining = 0;
        task.completed = true;
        state.completedCount++;

        state.activeId = null;
        state.lastTick = null;

        save();
        removeCompletedCard(task.id);
    }
}

/* TASK RENDERING */

function renderTasks() {
    const list = document.getElementById("taskList");
    list.innerHTML = "";

    const visible = state.tasks.filter(
        t => !t.completed
    );

    visible.forEach(task => {
        const active = state.activeId === task.id;

        const card = document.createElement("div");
        card.className = "task" + (active ? " active" : "");
        card.id = "task-" + task.id;

        const heading = document.createElement("div");
        heading.className = "task-head";

        const info = document.createElement("div");

        const name = document.createElement("div");
        name.className = "task-name";
        name.textContent = task.name;

        const duration = document.createElement("div");
        duration.className = "task-duration";
        duration.textContent =
            "PLANNED DURATION · " + task.duration + " MIN";

        info.append(name, duration);

        const status = document.createElement("div");
        status.className = "task-status";
        status.id = "status-" + task.id;
        status.textContent = active ? "RUNNING" : "READY";

        heading.append(info, status);

        const timer = document.createElement("div");
        timer.className = "timer";
        timer.id = "timer-" + task.id;
        timer.textContent = formatTime(task.remaining);

        const actions = document.createElement("div");
        actions.className = "actions";

        const start = document.createElement("button");
        start.className = "start-btn";
        start.innerHTML = active
            ? '<i class="fa-solid fa-play"></i> RUNNING'
            : task.remaining < task.duration * 60
                ? '<i class="fa-solid fa-play"></i> RESUME'
                : '<i class="fa-solid fa-play"></i> START';

        start.disabled = active;
        start.onclick = () => startTask(task.id);

        actions.appendChild(start);

        if (active) {
            const pause = document.createElement("button");
            pause.className = "pause-btn";
            pause.innerHTML = '<i class="fa-solid fa-pause"></i> PAUSE';
            pause.onclick = pauseTask;

            actions.appendChild(pause);
        }

        if (!isDefaultTask(task)) {
            const end = document.createElement("button");
            end.className = "end-btn";
            end.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> END';
            end.onclick = () => endTask(task.id);

            actions.appendChild(end);

            const del = document.createElement("button");
            del.className = "delete-btn";
            del.innerHTML = '<i class="fa-solid fa-trash"></i>';
            del.title = "Delete task";
            del.onclick = () => deleteTask(task.id);

            actions.appendChild(del);
        }

        card.append(heading, timer, actions);
        list.appendChild(card);
    });

    if (visible.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-trophy";

        const title = document.createElement("h3");
        title.textContent = "RACE COMPLETED";

        const text = document.createElement("p");
        text.textContent = "All tasks finished. Add another task to continue.";

        empty.append(icon, title, text);
        list.appendChild(empty);
    }

    updateDashboard();
}

/* REMOVE COMPLETED CARD */

function removeCompletedCard(id) {
    const card = document.getElementById("task-" + id);

    if (card) {
        card.classList.add("removing");

        setTimeout(() => {
            card.remove();
            updateEmptyState();
        }, 300);
    }

    updateDashboard();
}

function updateEmptyState() {
    const remaining = state.tasks.filter(t => !t.completed);

    if (remaining.length === 0) {
        const list = document.getElementById("taskList");

        if (!list.querySelector(".empty")) {
            const empty = document.createElement("div");
            empty.className = "empty";

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-trophy";

            const title = document.createElement("h3");
            title.textContent = "RACE COMPLETED";

            const text = document.createElement("p");
            text.textContent = "All tasks finished. Add another task to continue.";

            empty.append(icon, title, text);
            list.appendChild(empty);
        }
    }
}

/* DASHBOARD */

function updateDashboard() {
    const total = state.tasks.length;
    const completed = state.completedCount;

    const remaining = state.tasks.filter(
        t => !t.completed
    ).length;

    const percent = total
        ? Math.min(100, Math.round(completed / total * 100))
        : 0;

    document.getElementById("completed").textContent = completed;
    document.getElementById("remaining").textContent = remaining;

    document.getElementById("percentage").textContent =
        percent + "%";

    document.getElementById("progress").style.width =
        percent + "%";

    document.getElementById("taskCount").textContent =
        String(remaining).padStart(2, "0") + " TASKS";

    const mins = Math.floor(state.focusSeconds / 60);
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;

    document.getElementById("focusTime").textContent =
        hours ? hours + "h " + rest + "m" : mins + "m";
}

/* UPDATE TIMER WITHOUT REBUILDING CARDS */

function updateVisibleTimer() {
    if (!state.activeId) return;

    const task = state.tasks.find(
        t => t.id === state.activeId
    );

    if (!task) return;

    const timer = document.getElementById("timer-" + task.id);

    if (timer) {
        timer.textContent = formatTime(task.remaining);
    }
}

/* CONTROLS */

function startTask(id) {
    updateTimer();

    if (state.activeId) {
        state.activeId = null;
        state.lastTick = null;
    }

    const task = state.tasks.find(t => t.id === id);

    if (!task || task.completed || task.remaining <= 0) return;

    state.activeId = id;
    state.lastTick = Date.now();

    save();
    renderTasks();
}

function pauseTask() {
    updateTimer();

    state.activeId = null;
    state.lastTick = null;

    save();
    renderTasks();
}

function endTask(id) {
    updateTimer();

    const task = state.tasks.find(t => t.id === id);

    if (!task || task.completed || isDefaultTask(task)) return;

    task.completed = true;
    task.remaining = 0;
    state.completedCount++;

    if (state.activeId === id) {
        state.activeId = null;
        state.lastTick = null;
    }

    save();
    removeCompletedCard(id);
}

function deleteTask(id) {
    const target = state.tasks.find(t => t.id === id);

    if (!target || isDefaultTask(target)) return;
    if (!confirm("Delete this task?")) return;

    if (state.activeId === id) {
        state.activeId = null;
        state.lastTick = null;
    }

    state.tasks = state.tasks.filter(t => t.id !== id);

    save();
    renderTasks();
}

function addTask() {
    const nameInput = document.getElementById("taskName");
    const durationInput = document.getElementById("taskDuration");

    const name = nameInput.value.trim();
    const duration = Number(durationInput.value);

    if (!name) {
        alert("Enter a task name.");
        return;
    }

    if (!Number.isInteger(duration) ||
        duration < 1 || duration > 1440) {
        alert("Enter a duration between 1 and 1440 minutes.");
        return;
    }

    createTask(name, duration);

    nameInput.value = "";
    durationInput.value = "";
}

function resetDay() {
    if (!confirm("Reset all tasks and today's progress?")) return;

    state = newState();

    seedDefaults();
}

/* DAILY RESET */

function checkNewDay() {
    if (state.date !== today()) {
        state = newState();
        seedDefaults();

        viewYear = new Date().getFullYear();
        viewMonth = new Date().getMonth();
        renderStreak();
    }
}

/* DATE */

function updateDate() {
    document.getElementById("date").textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short"
        }).toUpperCase();
}

/* KEYBOARD */

document.getElementById("taskName")
    .addEventListener("keydown", e => {
        if (e.key === "Enter") addTask();
    });

document.getElementById("taskDuration")
    .addEventListener("keydown", e => {
        if (e.key === "Enter") addTask();
    });

/* INITIALISE */

checkNewDay();
updateDate();
if (!state.seeded) {
    seedDefaults();
} else {
    renderTasks();
}

recordHistory();
renderStreak();

/* Smooth timer updates without blinking */

setInterval(() => {
    checkNewDay();
    updateTimer();
    updateVisibleTimer();
    updateDashboard();
    save();
}, 1000);
