
"use strict";


/* =========================================
   ADMIN-ONLY ACCESS CHECK
========================================= */

const ADMIN_EMAIL = "computerbd78@gmail.com";

function verifyAdminAccess() {
    try {
        const user = JSON.parse(
            localStorage.getItem("loggedInUser") || "null"
        );

        const loginTime = Number(
            localStorage.getItem("loginTime")
        );

        const sessionValid =
            user &&
            Number.isFinite(loginTime) &&
            Date.now() - loginTime < 60 * 60 * 1000;

        const isAdmin =
            sessionValid &&
            String(user.email || "").toLowerCase() ===
            ADMIN_EMAIL.toLowerCase();

        if (!isAdmin) {
            alert("এই পেজে প্রবেশের অনুমতি নেই।");
            window.location.replace("./login.html");
            return false;
        }

        return true;

    } catch (error) {
        window.location.replace("./login.html");
        return false;
    }
}

if (!verifyAdminAccess()) {
    throw new Error("Admin access denied.");
}




// ==================================================
// CONFIGURATION
// BIN_URL এবং ACCESS_KEY config.js থেকে আসবে
// ==================================================

const $ = id => document.getElementById(id);

const CACHE_KEY = "muhasabaAdminCache";

let usersData = [];
let binRecord = {};
let busy = false;

// ==================================================
// BASIC HELPERS
// ==================================================

function showError(message) {
    $("errorBox")?.classList.remove("hidden");

    if ($("errorText")) {
        $("errorText").textContent = message;
    }

    setStatus("সমস্যা");
}

function clearError() {
    $("errorBox")?.classList.add("hidden");

    if ($("errorText")) {
        $("errorText").textContent = "";
    }
}

function setStatus(message) {
    if ($("saveStatus")) {
        $("saveStatus").textContent = message;
    }
}

function safeText(value) {
    return String(value ?? "");
}

function scoreOf(task) {
    const value = Number(task.score);

    return Number.isFinite(value) ? value : 0;
}

function formatScore(value) {
    return Number.isInteger(value)
        ? String(value)
        : String(Number(value.toFixed(2)));
}

function totalScore(user) {
    return (Array.isArray(user.tasks) ? user.tasks : [])
        .reduce((sum, task) => sum + scoreOf(task), 0);
}

// ইউজারের নির্ভরযোগ্য পরিচয়
function userIdentity(user) {
    if (user.id !== undefined && user.id !== null) {
        return "id:" + String(user.id);
    }

    return "email:" + safeText(user.email).toLowerCase();
}

// টাস্কের নির্ভরযোগ্য পরিচয়
function taskIdentity(task) {
    if (task.taskId !== undefined && task.taskId !== null) {
        return "taskId:" + String(task.taskId);
    }

    if (task.id !== undefined && task.id !== null) {
        return "id:" + String(task.id);
    }

    // ID না থাকলে নাম দিয়ে মিলানো হবে
    return "name:" + safeText(task.task || task.name).trim();
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
}

function updateStats() {
    $("totalUsers") && (
        $("totalUsers").textContent = usersData.length
    );

    $("totalTaskEntries") && (
        $("totalTaskEntries").textContent = usersData.reduce(
            (sum, user) =>
                sum + (Array.isArray(user.tasks) ? user.tasks.length : 0),
            0
        )
    );
}

function makeButton(label, className, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = label;

    button.addEventListener("click", callback);

    return button;
}

// ==================================================
// LOCAL STORAGE CACHE
// ==================================================

function saveAdminCache() {
    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
                record: binRecord,
                savedAt: Date.now()
            })
        );

        return true;
    } catch (error) {
        console.error("Cache save failed:", error);
        return false;
    }
}

function readAdminCache() {
    try {
        const value = localStorage.getItem(CACHE_KEY);

        if (!value) return null;

        const parsed = JSON.parse(value);

        if (!Array.isArray(parsed.record?.users)) {
            return null;
        }

        return parsed.record;
    } catch (error) {
        console.error("Cache read failed:", error);
        return null;
    }
}

// ==================================================
// NAVBAR
// ==================================================

function updateAdminNavbar() {
    let loggedIn = false;

    try {
        const user = JSON.parse(
            localStorage.getItem("loggedInUser") || "null"
        );

        const loginTime = Number(localStorage.getItem("loginTime"));
        const sessionValid =
            user &&
            Number.isFinite(loginTime) &&
            Date.now() - loginTime < 60 * 60 * 1000;

        loggedIn = Boolean(sessionValid);
    } catch {
        loggedIn = false;
    }

    $("login")?.classList.toggle("hidden", loggedIn);
    $("loginLink")?.classList.toggle("hidden", loggedIn);
    $("logout")?.classList.toggle("hidden", !loggedIn);
}

$("logout")?.addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("loginTime");

    window.location.href = "./login.html";
});

updateAdminNavbar();

// ==================================================
// LOAD DATA
// ==================================================

async function loadUsers(forceRefresh = false) {
    if (busy) return;

    clearError();

    // সাধারণ পেইজ রিফ্রেশে ক্যাশ দেখাও
    if (!forceRefresh) {
        const cachedRecord = readAdminCache();

        if (cachedRecord) {
            binRecord = cachedRecord;
            usersData = binRecord.users;

            renderUsers();
            updateStats();

            setStatus("লোকাল ক্যাশ থেকে লোড হয়েছে");

            if ($("connectionStatus")) {
                $("connectionStatus").textContent =
                    "Reload করলে সর্বশেষ ডেটা পাওয়া যাবে";
            }

            return;
        }
    }

    setStatus("JSONBin থেকে লোড হচ্ছে…");

    if ($("connectionStatus")) {
        $("connectionStatus").textContent = "সংযোগ হচ্ছে…";
    }

    try {
        const response = await fetch(BIN_URL, {
            headers: {
                "X-Access-Key": ACCESS_KEY
            }
        });

        if (!response.ok) {
            throw new Error(
                `ডেটা লোড হয়নি (HTTP ${response.status})`
            );
        }

        const data = await response.json();
        const record = data.record || data;

        if (!Array.isArray(record.users)) {
            throw new Error("JSONBin-এ users অ্যারে পাওয়া যায়নি।");
        }

        binRecord = record;
        usersData = binRecord.users;

        saveAdminCache();

        renderUsers();
        updateStats();

        setStatus("সর্বশেষ ডেটা লোড হয়েছে");

        if ($("connectionStatus")) {
            $("connectionStatus").textContent = "JSONBin সংযুক্ত";
        }

    } catch (error) {
        console.error(error);

        showError(
            error.message || "JSONBin থেকে ডেটা লোড করা যায়নি।"
        );

        if ($("connectionStatus")) {
            $("connectionStatus").textContent = "সংযোগ ব্যর্থ";
        }
    }
}

// ==================================================
// SAVE TO JSONBIN
// ==================================================

async function persistUsers(successMessage = "সেভ হয়েছে") {
    if (busy) return false;

    busy = true;

    setStatus("JSONBin-এ সেভ হচ্ছে…");

    document.querySelectorAll(
        "#usersContainer button, #resetAllBtn, #monthlyResetBtn, " +
        "#reloadBtn, #saveTaskEditBtn, #saveScoreBtn"
    ).forEach(button => {
        button.disabled = true;
    });

    try {
        // এই পেইজে লোড করা রেকর্ডের অন্য ফিল্ড অক্ষত রাখি
        binRecord.users = usersData;

        // সরাসরি PUT; সেভের আগে অতিরিক্ত GET নয়
        const response = await fetch(BIN_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Access-Key": ACCESS_KEY
            },
            body: JSON.stringify(binRecord)
        });

        if (!response.ok) {
            throw new Error(
                `JSONBin-এ সেভ হয়নি (HTTP ${response.status})`
            );
        }

        const result = await response.json();

        if (result.record && Array.isArray(result.record.users)) {
            binRecord = result.record;
            usersData = binRecord.users;
        }

        // সার্ভার সফল হওয়ার পরেই ক্যাশ আপডেট
        saveAdminCache();

        renderUsers();
        updateStats();

        setStatus(successMessage);

        if ($("connectionStatus")) {
            $("connectionStatus").textContent = "JSONBin সংযুক্ত";
        }

        return true;

    } catch (error) {
        console.error(error);

        showError(
            error.message || "পরিবর্তন সেভ করা যায়নি।"
        );

        return false;

    } finally {
        busy = false;

        document.querySelectorAll(
            "#usersContainer button, #resetAllBtn, #monthlyResetBtn, " +
            "#reloadBtn, #saveTaskEditBtn, #saveScoreBtn"
        ).forEach(button => {
            button.disabled = false;
        });
    }
}

// ==================================================
// RENDER USER CARDS
// ==================================================

function renderUsers() {
    const container = $("usersContainer");

    if (!container) return;

    const query = ($("searchUsers")?.value || "")
        .trim()
        .toLowerCase();

    container.innerHTML = "";

    const filtered = usersData.filter(user =>
        safeText(user.name).toLowerCase().includes(query) ||
        safeText(user.email).toLowerCase().includes(query)
    );

    if (!filtered.length) {
        container.innerHTML =
            '<div class="col-span-full rounded-2xl border border-base-300 bg-base-100 p-8 text-center">কোনো ইউজার পাওয়া যায়নি।</div>';
        return;
    }

    filtered.forEach(user => {
        const card = document.createElement("article");

        card.className =
            "rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm";

        // User header
        const header = document.createElement("div");

        header.className =
            "mb-3 flex items-start justify-between gap-3";

        const info = document.createElement("div");
        info.className = "min-w-0";

        const name = document.createElement("h2");
        name.className = "break-words text-lg font-bold text-primary";
        name.textContent = user.name || "নাম নেই";

        const email = document.createElement("p");
        email.className = "break-all text-xs text-base-content/60";
        email.textContent = user.email || "";

        const id = document.createElement("p");
        id.className = "mt-1 text-[10px] text-base-content/40";
        id.textContent = `ID: ${user.id ?? "N/A"}`;

        info.append(name, email, id);

        const total = document.createElement("div");
        total.className = "shrink-0 text-right";

        const totalValue = document.createElement("p");
        totalValue.className = "text-2xl font-bold text-primary";
        totalValue.textContent = formatScore(totalScore(user));

        const totalLabel = document.createElement("p");
        totalLabel.className = "text-[10px] tracking-widest opacity-50";
        totalLabel.textContent = "TOTAL SCORE";

        total.append(totalValue, totalLabel);
        header.append(info, total);
        card.appendChild(header);

        // User actions
        const userActions = document.createElement("div");
        userActions.className = "mb-4 flex flex-wrap gap-2";

        userActions.appendChild(
            makeButton(
                "Delete User",
                "btn btn-error btn-outline btn-xs",
                () => deleteUser(user)
            )
        );

        card.appendChild(userActions);

        // Task list
        const taskList = document.createElement("div");
        taskList.className = "space-y-2";

        const tasks = Array.isArray(user.tasks) ? user.tasks : [];

        tasks.forEach((task, index) => {
            const row = document.createElement("div");
            row.className = "rounded-xl bg-base-200 p-3";

            const taskHeader = document.createElement("div");
            taskHeader.className =
                "flex items-start justify-between gap-2";

            const taskInfo = document.createElement("div");
            taskInfo.className = "min-w-0 flex-1";

            const taskName = document.createElement("p");
            taskName.className = "break-words font-semibold";
            taskName.textContent =
                task.task || task.name || `টাস্ক ${index + 1}`;

            const rule = document.createElement("p");
            rule.className = "mt-1 break-words text-xs opacity-60";
            rule.textContent =
                "নিয়ম: " + (task.rule?.type || "custom rule");

            taskInfo.append(taskName, rule);

            const score = document.createElement("span");
            score.className = "badge badge-primary badge-lg shrink-0";
            score.textContent = formatScore(scoreOf(task));

            taskHeader.append(taskInfo, score);
            row.appendChild(taskHeader);

            const actions = document.createElement("div");
            actions.className = "mt-3 flex flex-wrap gap-2";

            actions.append(
                makeButton(
                    "Edit task / rule",
                    "btn btn-primary btn-xs",
                    () => openTaskEditor(task)
                ),
                makeButton(
                    "Edit score",
                    "btn btn-outline btn-xs",
                    () => openScoreEditor(user, task)
                ),
                makeButton(
                    "Reset score",
                    "btn btn-warning btn-xs",
                    () => resetOneTask(user, task)
                ),
                // makeButton(
                //     "Delete task",
                //     "btn btn-error btn-outline btn-xs",
                //     () => deleteTask(task)
                // )
            );

            row.appendChild(actions);
            taskList.appendChild(row);
        });

        if (!tasks.length) {
            const empty = document.createElement("p");
            empty.className = "text-sm opacity-60";
            empty.textContent = "এই ইউজারের কোনো টাস্ক নেই।";
            taskList.appendChild(empty);
        }

        card.appendChild(taskList);
        container.appendChild(card);
    });
}

// ==================================================
// DELETE USER
// ==================================================

async function deleteUser(user) {
    if (busy) return;

    const identity = userIdentity(user);

    const confirmed = confirm(
        ` "${user.name || user.email || "এই ইউজার"}" মুছে ফেলবে?\n\n` +
        "ইউজারের প্রোফাইল ও তার সব টাস্ক স্থায়ীভাবে JSONBin থেকে মুছে যাবে।"
    );

    if (!confirmed) return;

    const oldUsers = usersData;

    usersData = usersData.filter(
        item => userIdentity(item) !== identity
    );

    renderUsers();
    updateStats();

    const saved = await persistUsers("ইউজার ডিলেট হয়েছে");

    if (!saved) {
        usersData = oldUsers;

        renderUsers();
        updateStats();

        alert("ইউজার ডিলেট সেভ হয়নি। আগের তালিকা ফিরিয়ে দেওয়া হয়েছে।");
    }
}

// ==================================================
// DELETE TASK FROM ALL USERS
// ==================================================

// async function deleteTask(selectedTask) {
//     if (busy) return;

//     const identity = taskIdentity(selectedTask);
//     const taskName = selectedTask.task || selectedTask.name || "এই টাস্ক";

//     const confirmed = confirm(
//         `"${taskName}" টাস্কটি সব ইউজারের তালিকা থেকে মুছে ফেলবে?\n\n` +
//         "এতে এই টাস্কের স্কোরসহ সংশ্লিষ্ট ডাটা মুছে যাবে।"
//     );

//     if (!confirmed) return;

//     const oldUsers = usersData;

//     usersData = usersData.map(user => ({
//         ...user,
//         tasks: (Array.isArray(user.tasks) ? user.tasks : [])
//             .filter(task => taskIdentity(task) !== identity)
//     }));

//     renderUsers();
//     updateStats();

//     const saved = await persistUsers("টাস্ক সব ইউজার থেকে ডিলেট হয়েছে");

//     if (!saved) {
//         usersData = oldUsers;

//         renderUsers();
//         updateStats();

//         alert("টাস্ক ডিলেট সেভ হয়নি। আগের ডাটা ফিরিয়ে দেওয়া হয়েছে।");
//     }
// }

// ==================================================
// EDIT TASK / RULE
// ==================================================

function openTaskEditor(task) {
    $("editTaskKey").value = taskIdentity(task);

    $("editTaskName").value =
        task.task || task.name || "";

    $("editTaskRule").value =
        JSON.stringify(task.rule || {}, null, 2);

    $("editTaskModal").showModal();
}

$("editTaskForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const identity = $("editTaskKey").value;
    const newName = $("editTaskName").value.trim();

    let newRule;

    try {
        newRule = JSON.parse($("editTaskRule").value);

        if (
            newRule === null ||
            typeof newRule !== "object" ||
            Array.isArray(newRule)
        ) {
            throw new Error("নিয়মটি JSON object হতে হবে।");
        }
    } catch (error) {
        alert("স্কোরিং নিয়মের JSON সঠিক নয়: " + error.message);
        return;
    }

    if (!newName) {
        alert("টাস্কের নাম লিখো।");
        return;
    }

    const matchingTasks = [];

    usersData.forEach(user => {
        (Array.isArray(user.tasks) ? user.tasks : [])
            .forEach(task => {
                if (taskIdentity(task) === identity) {
                    matchingTasks.push(task);
                }
            });
    });

    if (!matchingTasks.length) {
        alert("টাস্কটি পাওয়া যায়নি। Reload করে আবার চেষ্টা করো।");
        return;
    }

    if (!confirm(
        "এই টাস্কের নাম ও নিয়ম সব ইউজারের জন্য পরিবর্তন করবে?"
    )) {
        return;
    }

    const previous = matchingTasks.map(task => ({
        task,
        oldTask: task.task,
        oldName: task.name,
        oldRule: cloneData(task.rule ?? {})
    }));

    matchingTasks.forEach(task => {
        task.task = newName;

        if ("name" in task) {
            task.name = newName;
        }

        task.rule = cloneData(newRule);
    });

    const saved = await persistUsers("টাস্ক ও নিয়ম সেভ হয়েছে");

    if (saved) {
        $("editTaskModal").close();
    } else {
        previous.forEach(item => {
            if (item.oldTask === undefined) {
                delete item.task.task;
            } else {
                item.task.task = item.oldTask;
            }

            if (item.oldName === undefined) {
                delete item.task.name;
            } else {
                item.task.name = item.oldName;
            }

            item.task.rule = item.oldRule;
        });

        renderUsers();
    }
});

// ==================================================
// EDIT SCORE
// ==================================================

function openScoreEditor(user, task) {
    $("editScoreUserId").value = userIdentity(user);
    $("editScoreTaskKey").value = taskIdentity(task);

    $("editScoreTitle").textContent =
        `${user.name || ""} — ${task.task || task.name || ""}`;

    $("editScoreValue").value = scoreOf(task);

    $("editScoreModal").showModal();
}

$("editScoreForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const userKey = $("editScoreUserId").value;
    const taskKey = $("editScoreTaskKey").value;
    const value = Number($("editScoreValue").value);

    if (!Number.isFinite(value) || value < 0) {
        alert("শূন্য বা তার বেশি সঠিক স্কোর লিখো।");
        return;
    }

    const user = usersData.find(
        item => userIdentity(item) === userKey
    );

    const task = user && (
        Array.isArray(user.tasks) ? user.tasks : []
    ).find(item => taskIdentity(item) === taskKey);

    if (!user || !task) {
        alert("ইউজার বা টাস্ক পাওয়া যায়নি।");
        return;
    }

    const oldValue = task.score;
    task.score = value;

    const saved = await persistUsers("স্কোর সেভ হয়েছে");

    if (saved) {
        $("editScoreModal").close();
    } else {
        task.score = oldValue;
        renderUsers();
    }
});

// ==================================================
// RESET ONE TASK SCORE
// ==================================================

async function resetOneTask(user, task) {
    if (busy) return;

    const confirmed = confirm(
        `${user.name || "এই ইউজার"}-এর ` +
        `"${task.task || task.name || "টাস্ক"}" স্কোর 0 করবে?`
    );

    if (!confirmed) return;

    const oldValue = task.score;
    task.score = 0;

    const saved = await persistUsers("টাস্কের স্কোর রিসেট হয়েছে");

    if (!saved) {
        task.score = oldValue;
        renderUsers();
    }
}

// ==================================================
// RESET ALL / MONTHLY RESET
// ==================================================

async function resetEveryTaskScore(message) {
    if (busy) return;

    const confirmed = confirm(
        message +
        "\n\nসব ইউজারের সব টাস্কের স্কোর 0 হবে। " +
        "নাম, ইমেইল, ID ও টাস্কগুলো থাকবে।"
    );

    if (!confirmed) return;

    const oldUsers = cloneData(usersData);

    usersData.forEach(user => {
        (Array.isArray(user.tasks) ? user.tasks : [])
            .forEach(task => {
                task.score = 0;
            });
    });

    renderUsers();
    updateStats();

    const saved = await persistUsers("সব টাস্কের স্কোর রিসেট হয়েছে");

    if (!saved) {
        usersData = oldUsers;

        renderUsers();
        updateStats();

        alert("রিসেট সেভ হয়নি। আগের ডাটা ফিরিয়ে দেওয়া হয়েছে।");
    }
}

$("resetAllBtn")?.addEventListener("click", () => {
    resetEveryTaskScore(
        "সব ইউজারের সব স্কোর রিসেট করতে চাও?"
    );
});

$("monthlyResetBtn")?.addEventListener("click", () => {
    resetEveryTaskScore(
        "মাসিক স্কোর রিসেট করতে চাও?"
    );
});

// ==================================================
// SEARCH / RELOAD / MODAL BUTTONS
// ==================================================

$("reloadBtn")?.addEventListener("click", () => {
    loadUsers(true);
});

$("searchUsers")?.addEventListener("input", renderUsers);

$("cancelEditTask")?.addEventListener("click", () => {
    $("editTaskModal")?.close();
});

$("cancelEditScore")?.addEventListener("click", () => {
    $("editScoreModal")?.close();
});

// ==================================================
// INITIALIZE
// ==================================================

if ($("usersContainer")) {
    loadUsers();
}
