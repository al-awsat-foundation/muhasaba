"use strict";

// ==========================================
// MUHASABA — DAILY TASKS + HIJRI MONTH
// JSONBin: BIN_URL ও ACCESS_KEY config.js থেকে
// ==========================================

const cardSection = document.getElementById("cardSection");
const DAILY_POINTS = 10;

let currentTasks = [];
let muhTaskCurrentUser = null;
let selectedDate = getDateKey();
let selectedAnswers = {};
let dateAlreadySubmitted = false;
let isSaving = false;

// ==========================================
// GENERAL HELPERS
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ==========================================
// HIJRI DATE HELPERS
// app.js-এর dateAdjustment থাকলে সেটি ব্যবহার হবে
// 0 = স্বাভাবিক, 1 = একদিন এগিয়ে, -1 = একদিন পিছিয়ে
// ==========================================

function getHijriAdjustedDate(dateKey) {
    const [year, month, day] = String(dateKey).split("-").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day, 12));

    const adjustment =
        typeof dateAdjustment === "number" &&
            Number.isFinite(dateAdjustment)
            ? dateAdjustment
            : 0;

    date.setUTCDate(date.getUTCDate() + adjustment);

    return date;
}

function getHijriParts(dateKey) {
    const date = getHijriAdjustedDate(dateKey);

    const formatter = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura-nu-latn",
        {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            timeZone: "UTC"
        }
    );

    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter(part => part.type !== "literal")
            .map(part => [part.type, part.value])
    );

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day)
    };
}

// হিজরি বছর-মাস: যেমন 1448-02
function getMonthKey(dateKey) {
    const hijri = getHijriParts(dateKey);

    return `${hijri.year}-${String(hijri.month).padStart(2, "0")}`;
}

function formatScore(value) {
    return Number(value || 0).toLocaleString("en-US");
}

function formatDate(dateKey) {
    if (!dateKey) return "";

    const [year, month, day] = dateKey.split("-");

    return `${day}/${month}/${year}`;
}

function formatHijriDate(dateKey) {
    if (!dateKey) return "";

    const hijri = getHijriParts(dateKey);

    const months = [
        "মুহররম",
        "সফর",
        "রবিউল আউয়াল",
        "রবিউস সানি",
        "জমাদিউল আউয়াল",
        "জমাদিউস সানি",
        "রজব",
        "শাবান",
        "রমজান",
        "শাওয়াল",
        "জিলকদ",
        "জিলহজ"
    ];

    const bnNumber = number =>
        new Intl.NumberFormat("bn-BD", {
            useGrouping: false
        }).format(number);

    const day = bnNumber(hijri.day);
    const year = bnNumber(hijri.year);
    const month = months[hijri.month - 1] || "";

    return `${day} ${month} ${year} হিজরি`;
}

function getMonthName(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);

    const months = [
        "মুহররম",
        "সফর",
        "রবিউল আউয়াল",
        "রবিউস সানি",
        "জমাদিউল আউয়াল",
        "জমাদিউস সানি",
        "রজব",
        "শাবান",
        "রমজান",
        "শাওয়াল",
        "জিলকদ",
        "জিলহজ"
    ];

    const banglaYear = new Intl.NumberFormat("bn-BD", {
        useGrouping: false
    }).format(year);

    return `${months[month - 1] || `মাস ${month}`} ${banglaYear} হিজরী`;
}

function getSubmissions(user) {
    return user?.dailySubmissions &&
        typeof user.dailySubmissions === "object"
        ? user.dailySubmissions
        : {};
}

// ==========================================
// MONTHLY CALCULATIONS — HIJRI MONTH
// ==========================================

function getMonthScore(user, monthKey) {
    return Object.values(getSubmissions(user))
        .filter(item =>
            item?.submitted &&
            getMonthKey(item.date || "") === monthKey
        )
        .reduce(
            (total, item) => total + Number(item.score || 0),
            0
        );
}

function getMonthSubmitCount(user, monthKey) {
    return Object.values(getSubmissions(user))
        .filter(item =>
            item?.submitted &&
            getMonthKey(item.date || "") === monthKey
        ).length;
}

function showNotice(message, type = "info") {
    let notice = document.getElementById("taskNotice");

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "taskNotice";

        if (cardSection?.parentElement) {
            cardSection.parentElement.insertBefore(notice, cardSection);
        }
    }

    const colors = {
        info: "bg-blue-50 text-blue-800 border-blue-200",
        success: "bg-emerald-50 text-emerald-800 border-emerald-200",
        warning: "bg-amber-50 text-amber-800 border-amber-200",
        error: "bg-rose-50 text-rose-800 border-rose-200"
    };

    notice.className =
        `mb-4 rounded-xl border px-4 py-3 text-sm ${colors[type] || colors.info
        }`;

    notice.textContent = message;
}

// ==========================================
// TASK ADVICE
// ==========================================

const taskAdvice = {
    "জামাতে সালাত": "দিনের প্রতিটি সালাতে আল্লাহর নৈকট্য অর্জনের চেষ্টা করুন।",
    "কুরআন তেলাওয়াত": "অল্প হলেও প্রতিদিন কুরআনের সঙ্গে সম্পর্ক রাখুন।",
    "কুরআন তেলাওয়াত": "অল্প হলেও প্রতিদিন কুরআনের সঙ্গে সম্পর্ক রাখুন।",
    "ইস্তিগফার": "নিজের ভুল স্মরণ করে আন্তরিকভাবে ক্ষমা প্রার্থনা করুন।",
    "দৃষ্টি হেফাজত": "আল্লাহর সন্তুষ্টির জন্য দৃষ্টিকে সংযত রাখুন।",
    "আগে ঘুমানো": "সময়মতো ঘুম শরীর ও ইবাদতের জন্য উপকারী।",
    "কিয়ামুল লাইল": "অল্প হলেও নিয়মিত আমলের চেষ্টা করুন।",
    "কিয়ামুল লাইল": "অল্প হলেও নিয়মিত আমলের চেষ্টা করুন।",
    "দাওয়াহ": "সুন্দর আচরণ ও কথার মাধ্যমে কল্যাণের দিকে আহ্বান করুন।",
    "দাওয়াহ": "সুন্দর আচরণ ও কথার মাধ্যমে কল্যাণের দিকে আহ্বান করুন।",
    "ইলম অর্জন": "প্রতিদিন কিছু না কিছু উপকারী জ্ঞান অর্জন করুন।",
    "সুন্নাত সালাত": "সুন্নাত আমলের মাধ্যমে নিজের ইবাদতকে সমৃদ্ধ করুন।",
    "হাঁটা ১০ মিনিট": "শরীরের যত্ন নেওয়াও গুরুত্বপূর্ণ দায়িত্ব।"
};

function getAdvice(taskName, answer) {
    if (answer === true) {
        return "আলহামদুলিল্লাহ! এই ভালো অভ্যাসটি ধরে রাখুন।";
    }

    if (answer === false) {
        return "হতাশ হবেন না। আগামীকাল আবার চেষ্টা করার সুযোগ আছে।";
    }

    return taskAdvice[taskName] ||
        "প্রতিদিন একটু একটু করে নিজেকে আরও ভালো করার চেষ্টা করুন।";
}

// ==========================================
// DESIGN
// ==========================================

function injectStyles() {
    if (document.getElementById("muhasabaDailyStyles")) return;

    const style = document.createElement("style");
    style.id = "muhasabaDailyStyles";

    style.textContent = `
        #cardSection {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
        }

        .muh-panel {
            grid-column: 1 / -1;
            background: #fff;
            border: 1px solid #e0ebe4;
            border-radius: 18px;
            padding: 16px;
            box-shadow: 0 4px 16px rgba(20, 83, 45, .045);
        }

        .muh-heading {
            color: #174d3b;
            font-weight: 800;
            font-size: 1.08rem;
        }

        .muh-muted {
            color: #789087;
            font-size: .84rem;
            line-height: 1.7;
        }

        .muh-date-input {
            display: block;
            width: 100%;
            max-width: 280px;
            margin-top: 9px;
            border: 1px solid #cfe0d5;
            background: #f8fbf8;
            color: #174d3b;
            padding: 11px 12px;
            border-radius: 11px;
            font: inherit;
        }

        .muh-task-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
            border: 1px solid #e0ebe4;
            background: #fff;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 3px 12px rgba(20, 83, 45, .035);
            transition: border-color .2s, background .2s;
        }

        .muh-task-card.is-yes {
            border-color: #8cc8a7;
            background: #fbfefb;
        }

        .muh-task-top {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .muh-task-number {
            flex: 0 0 36px;
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: #edf5ef;
            color: #216449;
            font-size: .8rem;
            font-weight: 800;
        }

        .muh-task-info {
            flex: 1;
            min-width: 0;
        }

        .muh-task-name {
            color: #174d3b;
            font-weight: 800;
            line-height: 1.6;
        }

        .muh-task-advice {
            margin-top: 3px;
            color: #789087;
            font-size: .82rem;
            line-height: 1.7;
        }

        .muh-status-circle {
            flex: 0 0 30px;
            width: 30px;
            height: 30px;
            display: grid;
            place-items: center;
            border: 2px solid #d2ddd3;
            border-radius: 50%;
            color: #fff;
            font-size: 17px;
            font-weight: 800;
        }

        .muh-status-circle.is-yes {
            border-color: #27805b;
            background: #27805b;
        }

        .muh-status-circle.is-no {
            border-color: #dc6c6c;
            background: #dc6c6c;
        }

        .muh-answer-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
        }

        .muh-answer-btn {
            min-height: 44px;
            border: 1px solid #dce8df;
            border-radius: 12px;
            background: #f8fbf8;
            color: #35664f;
            font-weight: 700;
            cursor: pointer;
            transition: background .15s, color .15s;
        }

        .muh-answer-btn.is-yes {
            background: #27805b;
            border-color: #27805b;
            color: white;
        }

        .muh-answer-btn.is-no {
            background: #fff0ef;
            border-color: #f3c9c6;
            color: #c64f49;
        }

        .muh-answer-btn:disabled {
            opacity: .72;
            cursor: not-allowed;
        }

        .muh-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
        }

        .muh-summary-item {
            border-radius: 12px;
            background: #f2f8f3;
            padding: 12px 6px;
            text-align: center;
        }

        .muh-summary-value {
            color: #216449;
            font-size: 1.25rem;
            font-weight: 900;
        }

        .muh-summary-label {
            color: #789087;
            font-size: .74rem;
            margin-top: 3px;
        }

        .muh-submit-btn {
            width: 100%;
            min-height: 48px;
            border: 0;
            border-radius: 12px;
            background: #27805b;
            color: #fff;
            font-weight: 800;
            padding: 12px 16px;
            cursor: pointer;
        }

        .muh-submit-btn:disabled {
            opacity: .45;
            cursor: not-allowed;
        }

        .muh-history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            width: 100%;
            border: 1px solid #e0ebe4;
            border-radius: 12px;
            background: white;
            padding: 12px;
            text-align: left;
            cursor: pointer;
        }

        .muh-history-item.is-selected {
            border-color: #27805b;
            background: #f0f8f2;
        }

        .muh-history-score {
            color: #216449;
            font-weight: 900;
            white-space: nowrap;
        }

        .muh-history-details {
            margin-top: 8px;
            padding: 12px;
            border-radius: 12px;
            background: #f7faf7;
            color: #466457;
            font-size: .84rem;
            line-height: 1.9;
        }

        .muh-empty-history {
            color: #789087;
            font-size: .88rem;
            text-align: center;
            padding: 16px 8px;
        }

        @media (min-width: 700px) {
            .muh-task-card {
                grid-template-columns: minmax(0, 1fr) 220px;
                align-items: center;
                column-gap: 20px;
            }

            .muh-answer-row {
                grid-column: 2;
                grid-row: 1;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .muh-task-card, .muh-answer-btn {
                transition: none;
            }
        }
    `;

    document.head.appendChild(style);
}

// ==========================================
// RENDER TASKS
// ==========================================

function renderTaskCards(tasks = null) {
    if (!cardSection) {
        console.error('HTML-এ id="cardSection" পাওয়া যায়নি।');
        return;
    }

    const storedUser = JSON.parse(
        localStorage.getItem("loggedInUser") || "null"
    );

    currentTasks = Array.isArray(tasks)
        ? tasks
        : Array.isArray(storedUser?.tasks)
            ? storedUser.tasks
            : (typeof defaultTasks !== "undefined" ? defaultTasks : []);

    muhTaskCurrentUser = storedUser;

    buildDailyTaskUI();
}

function buildDailyTaskUI() {
    injectStyles();

    if (!cardSection) return;

    if (!currentTasks.length) {
        cardSection.innerHTML =
            '<div class="muh-panel">কোনো টাস্ক পাওয়া যায়নি।</div>';
        return;
    }

    const submissions = getSubmissions(muhTaskCurrentUser);
    const savedRecord = submissions[selectedDate];

    dateAlreadySubmitted = Boolean(savedRecord?.submitted);

    selectedAnswers = savedRecord?.answers &&
        typeof savedRecord.answers === "object"
        ? { ...savedRecord.answers }
        : {};

    cardSection.innerHTML = "";

    // Date selection panel
    const datePanel = document.createElement("section");
    datePanel.className = "muh-panel";

    datePanel.innerHTML = `
        <h2 class="muh-heading">দৈনিক মুহাসাবা</h2>
        <p class="muh-muted">
            আগের কোনো দিনের হিসাব বাদ পড়লে সেই তারিখ নির্বাচন করে জমা দিতে পারবেন।
        </p>

        <label class="block mt-3 text-sm font-bold text-emerald-900"
            for="muhSubmissionDate">ইংরেজি ক্যালেন্ডারের তারিখ</label>

        <input id="muhSubmissionDate"
            class="muh-date-input"
            type="date"
            value="${escapeHTML(selectedDate)}"
            max="${getDateKey()}" />

        <p class="muh-muted mt-2">
            হিজরি তারিখ: <strong>${escapeHTML(formatHijriDate(selectedDate))}</strong>
        </p>

        <p id="muhDateStatus" class="muh-muted mt-2"></p>
    `;

    cardSection.appendChild(datePanel);

    datePanel.querySelector("#muhSubmissionDate")
        .addEventListener("change", event => {
            const chosenDate = event.target.value;

            if (!chosenDate || chosenDate > getDateKey()) {
                showNotice("ভবিষ্যতের তারিখ নির্বাচন করা যাবে না।", "warning");
                event.target.value = selectedDate;
                return;
            }

            selectedDate = chosenDate;
            buildDailyTaskUI();
        });

    // Monthly summary uses the HIJRI month key
    const monthKey = getMonthKey(selectedDate);
    const monthScore = getMonthScore(muhTaskCurrentUser, monthKey);
    const submitCount = getMonthSubmitCount(muhTaskCurrentUser, monthKey);

    const summary = document.createElement("section");
    summary.className = "muh-panel";

    summary.innerHTML = `
        <p class="muh-muted">${escapeHTML(getMonthName(monthKey))} — মাসিক সারাংশ</p>

        <div class="muh-summary-grid mt-3">
            <div class="muh-summary-item">
                <div class="muh-summary-value">${formatScore(monthScore)}</div>
                <div class="muh-summary-label">মোট পয়েন্ট</div>
            </div>

            <div class="muh-summary-item">
                <div class="muh-summary-value">${submitCount}</div>
                <div class="muh-summary-label">সাবমিটের দিন</div>
            </div>

            <div class="muh-summary-item">
                <div class="muh-summary-value">${Math.max(0, 100 - monthScore)}</div>
                <div class="muh-summary-label">১০০ থেকে বাকি*</div>
            </div>
        </div>
    `;

    cardSection.appendChild(summary);

    const dateStatus = datePanel.querySelector("#muhDateStatus");

    if (dateAlreadySubmitted) {
        dateStatus.textContent =
            `✓ ${formatHijriDate(selectedDate)} (${formatDate(selectedDate)})-এর হিসাব জমা হয়েছে। স্কোর: ${formatScore(savedRecord.score)} পয়েন্ট।`;

        dateStatus.style.color = "#216449";
    } else {
        dateStatus.textContent =
            `${formatHijriDate(selectedDate)} (${formatDate(selectedDate)})-এর হিসাব এখনো জমা হয়নি।`;
    }

    // Task cards
    currentTasks.forEach((task, index) => {
        const card = document.createElement("article");
        card.className = "muh-task-card";

        const key = String(task.taskId);
        const answer = selectedAnswers[key];
        const isYes = answer === true;
        const isNo = answer === false;

        if (isYes) card.classList.add("is-yes");

        card.innerHTML = `
            <div class="muh-task-top">
                <span class="muh-task-number">${String(index + 1).padStart(2, "0")}</span>

                <div class="muh-task-info">
                    <h3 class="muh-task-name">${escapeHTML(task.task || `কাজ ${index + 1}`)}</h3>
                    <p class="muh-task-advice">${escapeHTML(getAdvice(task.task, answer))}</p>
                </div>

                <span class="muh-status-circle ${isYes ? "is-yes" : isNo ? "is-no" : ""}">
                    ${isYes ? "✓" : isNo ? "×" : ""}
                </span>
            </div>

            <div class="muh-answer-row">
                <button type="button"
                    class="muh-answer-btn ${isYes ? "is-yes" : ""}"
                    data-answer="yes"
                    ${dateAlreadySubmitted ? "disabled" : ""}>
                    ✓ হ্যাঁ · ১০
                </button>

                <button type="button"
                    class="muh-answer-btn ${isNo ? "is-no" : ""}"
                    data-answer="no"
                    ${dateAlreadySubmitted ? "disabled" : ""}>
                    ✕ না · ০
                </button>
            </div>
        `;

        card.querySelectorAll(".muh-answer-btn").forEach(button => {
            button.addEventListener("click", () => {
                if (dateAlreadySubmitted || isSaving) return;

                const newAnswer = button.dataset.answer === "yes";
                selectedAnswers[key] = newAnswer;

                card.classList.toggle("is-yes", newAnswer);

                const yesButton = card.querySelector('[data-answer="yes"]');
                const noButton = card.querySelector('[data-answer="no"]');
                const circle = card.querySelector(".muh-status-circle");
                const advice = card.querySelector(".muh-task-advice");

                yesButton.classList.toggle("is-yes", newAnswer);
                noButton.classList.toggle("is-no", !newAnswer);

                circle.classList.toggle("is-yes", newAnswer);
                circle.classList.toggle("is-no", !newAnswer);
                circle.textContent = newAnswer ? "✓" : "×";

                advice.textContent = getAdvice(task.task, newAnswer);

                updateProgress();
            });
        });

        cardSection.appendChild(card);
    });

    // Submit panel
    const submitPanel = document.createElement("section");
    submitPanel.className = "muh-panel";

    submitPanel.innerHTML = `
        <p id="muhAnswerCount" class="muh-muted mb-3"></p>

        <button id="muhSubmitButton" type="button" class="muh-submit-btn">
            হিসাব জমা দিন
        </button>

        <p class="muh-muted mt-3 text-center">
            একটি ইংরেজি তারিখের হিসাব একবারই জমা দেওয়া যাবে।
        </p>
    `;

    cardSection.appendChild(submitPanel);

    const submitButton = submitPanel.querySelector("#muhSubmitButton");

    function updateProgress() {
        const answeredCount = currentTasks.filter(task =>
            Object.prototype.hasOwnProperty.call(
                selectedAnswers,
                String(task.taskId)
            )
        ).length;

        submitPanel.querySelector("#muhAnswerCount").textContent =
            `${answeredCount}/${currentTasks.length}টি কাজের উত্তর দেওয়া হয়েছে।`;

        submitButton.disabled =
            dateAlreadySubmitted ||
            isSaving ||
            answeredCount !== currentTasks.length;

        submitButton.textContent = dateAlreadySubmitted
            ? "✓ এই তারিখের হিসাব জমা হয়েছে"
            : isSaving
                ? "জমা হচ্ছে..."
                : answeredCount !== currentTasks.length
                    ? "সব কাজের উত্তর দিন"
                    : `${formatHijriDate(selectedDate)}-এর হিসাব জমা দিন`;
    }

    submitButton.addEventListener("click", async () => {
        if (dateAlreadySubmitted || isSaving) return;

        if (!muhTaskCurrentUser?.email) {
            window.location.href = "./pages/login.html";
            return;
        }

        const answeredCount = currentTasks.filter(task =>
            Object.prototype.hasOwnProperty.call(
                selectedAnswers,
                String(task.taskId)
            )
        ).length;

        if (answeredCount !== currentTasks.length) {
            showNotice("সাবমিট করার আগে সব কাজের উত্তর দিন।", "warning");
            return;
        }

        await submitDailyAnswers(updateProgress);
    });

    updateProgress();
    renderHistory();
}

// ==========================================
// SUBMIT SELECTED DATE
// ==========================================

async function submitDailyAnswers(updateProgress) {
    const loggedInUser = JSON.parse(
        localStorage.getItem("loggedInUser") || "null"
    );

    if (!loggedInUser?.email) {
        window.location.href = "./pages/login.html";
        return;
    }

    if (selectedDate > getDateKey()) {
        showNotice("ভবিষ্যতের তারিখে হিসাব জমা দেওয়া যাবে না।", "warning");
        return;
    }

    isSaving = true;
    updateProgress?.();

    try {
        const response = await fetch(BIN_URL, {
            method: "GET",
            headers: { "X-Access-Key": ACCESS_KEY },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("JSONBin থেকে ডেটা লোড করা যায়নি।");
        }

        const result = await response.json();
        const record = result.record;
        const users = Array.isArray(record?.users) ? record.users : [];

        const user = users.find(item =>
            String(item.email || "").toLowerCase() ===
            String(loggedInUser.email).toLowerCase()
        );

        if (!user) {
            throw new Error("JSONBin-এ আপনার অ্যাকাউন্ট পাওয়া যায়নি।");
        }

        user.dailySubmissions = getSubmissions(user);

        // Duplicate prevention uses the exact Gregorian date.
        if (user.dailySubmissions[selectedDate]?.submitted) {
            localStorage.setItem("loggedInUser", JSON.stringify(user));

            showNotice("এই তারিখের হিসাব আগেই জমা দেওয়া হয়েছে।", "warning");

            muhTaskCurrentUser = user;
            isSaving = false;
            buildDailyTaskUI();
            return;
        }

        const normalizedAnswers = {};
        let dailyScore = 0;

        for (const task of currentTasks) {
            const key = String(task.taskId);

            if (!Object.prototype.hasOwnProperty.call(selectedAnswers, key)) {
                throw new Error("সব কাজের উত্তর দেওয়া বাধ্যতামূলক।");
            }

            normalizedAnswers[key] = Boolean(selectedAnswers[key]);

            if (normalizedAnswers[key]) {
                dailyScore += DAILY_POINTS;
            }
        }

        // IMPORTANT: monthly key is Hijri year-month.
        const monthKey = getMonthKey(selectedDate);

        user.monthlyScores = user.monthlyScores || {};
        user.monthlySubmitCounts = user.monthlySubmitCounts || {};
        user.monthlyTaskScores = user.monthlyTaskScores || {};

        const monthlyTaskScores =
            user.monthlyTaskScores[monthKey] &&
                typeof user.monthlyTaskScores[monthKey] === "object"
                ? user.monthlyTaskScores[monthKey]
                : {};

        // Rebuild the task totals for this Hijri month from dated records.
        // Add the current record first, then calculate from all submissions.
        user.dailySubmissions[selectedDate] = {
            date: selectedDate,
            month: monthKey,
            hijriDate: formatHijriDate(selectedDate),
            answers: normalizedAnswers,
            score: dailyScore,
            submitted: true,
            submittedAt: new Date().toISOString()
        };

        const monthRecords = Object.values(user.dailySubmissions).filter(item =>
            item?.submitted &&
            item.date &&
            getMonthKey(item.date) === monthKey
        );

        for (const task of currentTasks) {
            const key = String(task.taskId);

            monthlyTaskScores[key] = monthRecords.reduce((total, item) => {
                return total + (item.answers?.[key] === true ? DAILY_POINTS : 0);
            }, 0);

            const savedTask = (user.tasks || []).find(item =>
                String(item.taskId) === key
            );

            if (savedTask) {
                savedTask.score = monthlyTaskScores[key];
                savedTask.rule = {
                    type: "yes_no",
                    yesScore: DAILY_POINTS,
                    noScore: 0
                };
            }
        }

        user.monthlyTaskScores[monthKey] = monthlyTaskScores;
        user.monthlyScores[monthKey] = getMonthScore(user, monthKey);
        user.monthlySubmitCounts[monthKey] = getMonthSubmitCount(user, monthKey);

        const updateResponse = await fetch(BIN_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Access-Key": ACCESS_KEY
            },
            body: JSON.stringify(record)
        });

        if (!updateResponse.ok) {
            throw new Error("JSONBin-এ হিসাব সেভ করা যায়নি।");
        }

        localStorage.setItem("loggedInUser", JSON.stringify(user));

        muhTaskCurrentUser = user;
        isSaving = false;

        showNotice(
            `${formatHijriDate(selectedDate)} (${formatDate(selectedDate)})-এর হিসাব জমা হয়েছে। স্কোর: ${dailyScore}/100।`,
            "success"
        );

        buildDailyTaskUI();

    } catch (error) {
        console.error("Muhasaba submit error:", error);

        isSaving = false;

        showNotice(
            error.message || "হিসাব জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
            "error"
        );

        updateProgress?.();
    }
}

// ==========================================
// SUBMISSION HISTORY
// ==========================================

function renderHistory() {
    const submissions = getSubmissions(muhTaskCurrentUser);

    const history = Object.values(submissions)
        .filter(item => item?.submitted && item.date)
        .sort((a, b) => b.date.localeCompare(a.date));

    const panel = document.createElement("section");
    panel.className = "muh-panel";

    panel.innerHTML = `
        <h2 class="muh-heading">জমা দেওয়ার ইতিহাস</h2>

        <p class="muh-muted mt-1 mb-3">
            জমা দেওয়া যেকোনো তারিখ নির্বাচন করে সেদিনের উত্তর দেখতে পারবেন।
        </p>

        <div id="muhHistoryList" class="grid gap-2"></div>
    `;

    const list = panel.querySelector("#muhHistoryList");

    if (!history.length) {
        list.innerHTML = `
            <p class="muh-empty-history">
                এখনো কোনো হিসাব জমা দেওয়া হয়নি।
            </p>
        `;
    } else {
        history.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";

            button.className =
                `muh-history-item ${item.date === selectedDate ? "is-selected" : ""
                }`;

            button.innerHTML = `
                <span>
                    <span class="block font-bold text-emerald-900">
                        ${escapeHTML(formatHijriDate(item.date))}
                    </span>

                    <span class="block text-xs text-slate-500 mt-1">
                        ইংরেজি তারিখ: ${escapeHTML(formatDate(item.date))}
                        · ${escapeHTML(getMonthName(getMonthKey(item.date)))}
                    </span>
                </span>

                <span class="muh-history-score">
                    ${formatScore(item.score)} / 100
                </span>
            `;

            button.addEventListener("click", () => {
                selectedDate = item.date;
                buildDailyTaskUI();

                document.getElementById("muhSubmissionDate")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
            });

            list.appendChild(button);

            if (item.date === selectedDate) {
                const details = document.createElement("div");
                details.className = "muh-history-details";

                const answers = item.answers || {};

                details.innerHTML = currentTasks.map((task, index) => {
                    const answer = answers[String(task.taskId)];

                    const label = answer === true
                        ? "✓ হ্যাঁ · ১০"
                        : answer === false
                            ? "✕ না · ০"
                            : "উত্তর পাওয়া যায়নি";

                    return `
                        <div>
                            <strong>${index + 1}. ${escapeHTML(task.task)}</strong>
                            <span> — ${label}</span>
                        </div>
                    `;
                }).join("");

                list.appendChild(details);
            }
        });
    }

    cardSection.appendChild(panel);
}

// ==========================================
// LOAD LATEST USER DATA
// ==========================================

async function initializeTaskCards() {
    injectStyles();

    const loggedInUser = JSON.parse(
        localStorage.getItem("loggedInUser") || "null"
    );

    if (!loggedInUser?.email) {
        muhTaskCurrentUser = null;

        currentTasks =
            typeof defaultTasks !== "undefined" ? defaultTasks : [];

        buildDailyTaskUI();

        showNotice("দৈনিক হিসাব জমা দিতে আগে লগইন করুন।", "info");
        return;
    }

    try {
        const response = await fetch(BIN_URL, {
            method: "GET",
            headers: { "X-Access-Key": ACCESS_KEY },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("JSONBin থেকে ডেটা লোড করা যায়নি।");
        }

        const data = await response.json();

        const users = Array.isArray(data.record?.users)
            ? data.record.users
            : [];

        const latestUser = users.find(user =>
            String(user.email || "").toLowerCase() ===
            String(loggedInUser.email).toLowerCase()
        );

        if (!latestUser) {
            throw new Error("JSONBin-এ লগইন করা ইউজারকে পাওয়া যায়নি।");
        }

        muhTaskCurrentUser = latestUser;

        currentTasks = Array.isArray(latestUser.tasks)
            ? latestUser.tasks
            : [];

        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(latestUser)
        );

        buildDailyTaskUI();

    } catch (error) {
        console.error("Muhasaba loading error:", error);

        muhTaskCurrentUser = loggedInUser;

        currentTasks = Array.isArray(loggedInUser.tasks)
            ? loggedInUser.tasks
            : (typeof defaultTasks !== "undefined" ? defaultTasks : []);

        buildDailyTaskUI();

        showNotice(
            "সর্বশেষ ডেটা লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
            "warning"
        );
    }
}

initializeTaskCards();