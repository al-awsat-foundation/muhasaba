"use strict";

// ================================================
// JSONBIN CONFIGURATION
// BIN_URL এবং ACCESS_KEY config.js থেকে আসবে
// ================================================


// ================================================
// HTML ELEMENTS
// ================================================

const rankingMessage = document.getElementById("rankingMessage");
const lastUpdated = document.getElementById("lastUpdated");

const podiumSection = document.getElementById("podiumSection");
const rankingTableBody = document.getElementById("rankingTableBody");

const userCountElement = document.getElementById("userCount");

const myPositionSection = document.getElementById("myPositionSection");
const myNameElement = document.getElementById("myName");
const myScoreElement = document.getElementById("myScore");
const myPositionText = document.getElementById("myPositionText");

const penaltySection = document.getElementById("penaltySection");
const penaltyList = document.getElementById("penaltyList");

const emptyRanking = document.getElementById("emptyRanking");

const loginLink = document.getElementById("loginLink");
const logoutBtn = document.getElementById("logout");


// ================================================
// HELPER FUNCTIONS
// ================================================

// নিরাপদে HTML-এ Text দেখানো
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// স্কোর এক দশমিক ঘর পর্যন্ত দেখানো
function formatScore(score) {
    return Number(score || 0).toFixed(1);
}


// বাংলা সংখ্যায় রূপান্তর
function toBanglaNumber(number) {
    return String(number).replace(/\d/g, digit =>
        "০১২৩৪৫৬৭৮৯"[Number(digit)]
    );
}


// নামের প্রথম অক্ষর
function getInitial(name) {
    const cleanName = String(name || "").trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "?";
}


// ================================================
// LOGIN / LOGOUT NAVBAR
// ================================================

function updateNavbar() {
    let loggedInUser = null;

    try {
        loggedInUser = JSON.parse(
            localStorage.getItem("loggedInUser") || "null"
        );
    } catch (error) {
        console.error("Login data could not be read:", error);
    }

    const isLoggedIn = Boolean(loggedInUser?.email);

    if (loginLink) {
        loginLink.classList.toggle("hidden", isLoggedIn);
    }

    if (logoutBtn) {
        logoutBtn.classList.toggle("hidden", !isLoggedIn);
    }
}


if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("loggedInUser");
        window.location.href = "../index.html";
    });
}

updateNavbar();


// ================================================
// GET LOGGED-IN USER
// ================================================

function getLoggedInUser() {
    try {
        return JSON.parse(
            localStorage.getItem("loggedInUser") || "null"
        );
    } catch {
        return null;
    }
}


// ================================================
// CURRENT HIJRI MONTH + MONTHLY STATS
// ================================================

function getCurrentHijriMonthKey() {
    const now = new Date();

    const date = new Date(Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ));

    // app.js-এর dateAdjustment থাকলে সেটিও প্রয়োগ হবে।
    if (typeof dateAdjustment !== "undefined") {
        date.setUTCDate(
            date.getUTCDate() + Number(dateAdjustment || 0)
        );
    }

    const parts = new Intl.DateTimeFormat(
        "en-US-u-ca-islamic-umalqura-nu-latn",
        {
            year: "numeric",
            month: "numeric",
            timeZone: "UTC"
        }
    ).formatToParts(date);

    const year = Number(
        parts.find(part => part.type === "year")?.value
    );

    const month = Number(
        parts.find(part => part.type === "month")?.value
    );

    return `${year}-${String(month).padStart(2, "0")}`;
}


const rankingMonthKey = getCurrentHijriMonthKey();


function getMonthlyStats(user) {
    const submissions =
        user.dailySubmissions &&
            typeof user.dailySubmissions === "object"
            ? Object.values(user.dailySubmissions)
            : [];

    // বর্তমান হিজরি মাসের সাবমিশনগুলো নেওয়া হচ্ছে।
    const monthSubmissions = submissions.filter(item =>
        item?.submitted &&
        item.month === rankingMonthKey
    );

    if (monthSubmissions.length > 0) {
        const totalScore = monthSubmissions.reduce(
            (sum, item) => {
                const score = Number(item.score);

                return sum + (
                    Number.isFinite(score) ? score : 0
                );
            },
            0
        );

        return {
            totalScore: Number(totalScore.toFixed(1)),
            submitCount: monthSubmissions.length
        };
    }

    // পুরোনো ডেটার জন্য সংরক্ষিত মাসিক হিসাব।
    return {
        totalScore: Number(
            user.monthlyScores?.[rankingMonthKey] || 0
        ),

        submitCount: Number(
            user.monthlySubmitCounts?.[rankingMonthKey] || 0
        )
    };
}


// ================================================
// SORT RANKING
// ================================================

function sortUsers(users) {
    return users
        .map(user => {
            const monthlyStats = getMonthlyStats(user);

            return {
                ...user,

                name: String(user.name || "নাম নেই"),

                email: String(user.email || ""),

                totalScore: monthlyStats.totalScore,

                submitCount: monthlyStats.submitCount
            };
        })
        .sort((a, b) => {
            // বেশি মাসিক স্কোর আগে থাকবে।
            if (a.totalScore !== b.totalScore) {
                return b.totalScore - a.totalScore;
            }

            // স্কোর সমান হলে নামের বর্ণানুক্রম।
            return a.name.localeCompare(
                b.name,
                "bn",
                { sensitivity: "base" }
            );
        });
}


// ================================================
// TOP 3 PODIUM
// ================================================

function renderPodium(users) {
    podiumSection.innerHTML = "";

    if (users.length === 0) return;

    const podiumSettings = {
        1: {
            medal: "🥇",
            label: "CHAMPION",
            title: "১ম স্থান",
            cardClass: "podium-first",
            orderClass: "sm:order-2",
            scoreColor: "text-amber-700"
        },

        2: {
            medal: "🥈",
            label: "RUNNER UP",
            title: "২য় স্থান",
            cardClass: "podium-second",
            orderClass: "sm:order-1",
            scoreColor: "text-slate-700"
        },

        3: {
            medal: "🥉",
            label: "THIRD PLACE",
            title: "৩য় স্থান",
            cardClass: "podium-third",
            orderClass: "sm:order-3",
            scoreColor: "text-orange-800"
        }
    };

    // Desktop-এ ২য়, ১ম, ৩য় ক্রমে দেখাবে।
    const displayOrder = [
        { user: users[1], rank: 2 },
        { user: users[0], rank: 1 },
        { user: users[2], rank: 3 }
    ];

    displayOrder.forEach(({ user, rank }) => {
        if (!user) return;

        const settings = podiumSettings[rank];

        const card = document.createElement("article");

        card.className = `
            podium-card
            ${settings.cardClass}
            ${settings.orderClass}
            p-6
            text-center
        `;

        card.innerHTML = `
            <p class="text-[10px] font-bold tracking-[0.2em]
                      text-slate-400 mb-4">
                ${settings.label}
            </p>

            <div class="medal-circle mb-4">
                ${settings.medal}
            </div>

            <p class="text-xs font-semibold text-slate-500 mb-2">
                ${settings.title}
            </p>

            <h3 class="text-lg md:text-xl font-bold text-slate-800
                       break-words">
                ${escapeHTML(user.name)}
            </h3>

            <div class="mt-5 pt-4 border-t border-slate-200/70">
                <p class="text-xs text-slate-500 mb-1">
                    মোট স্কোর
                </p>

                <p class="score-number text-3xl font-bold
                          ${settings.scoreColor}">
                    ${formatScore(user.totalScore)}
                </p>
            </div>
        `;

        podiumSection.appendChild(card);
    });
}


// ================================================
// FULL RANKING TABLE
// ================================================

// স্কোরের আগে সাবমিট কলাম যোগ করা।
function ensureSubmitColumnHeader() {
    const headerRow =
        document.querySelector("#rankingTable thead tr") ||
        document.querySelector("thead tr");

    if (!headerRow) return;

    // একই হেডার যেন একাধিকবার যোগ না হয়।
    if (
        [...headerRow.cells].some(
            cell => cell.dataset.submitHeader === "true"
        )
    ) {
        return;
    }

    const header = document.createElement("th");

    header.textContent = "সাবমিট সংখ্যা";
    header.className = "text-right";
    header.dataset.submitHeader = "true";

    const scoreHeader = [...headerRow.cells].find(cell =>
        /স্কোর|পয়েন্ট|পয়েন্ট|total|point/i.test(
            cell.textContent || ""
        )
    );

    if (scoreHeader) {
        headerRow.insertBefore(header, scoreHeader);
    } else {
        headerRow.appendChild(header);
    }
}


function renderRankingTable(users) {
    ensureSubmitColumnHeader();

    rankingTableBody.innerHTML = "";

    const loggedInUser = getLoggedInUser();

    const loggedInEmail = String(
        loggedInUser?.email || ""
    ).toLowerCase();

    users.forEach((user, index) => {
        const rank = index + 1;

        const isCurrentUser =
            loggedInEmail !== "" &&
            user.email.toLowerCase() === loggedInEmail;

        // প্রথম তিনজন।
        const isTopThree = rank <= 3;

        // শেষ তিনজন জরিমানার পর্যায়ে।
        const isPenaltyUser =
            users.length > 3 &&
            rank > 3 &&
            rank > users.length - 3;

        let statusHTML = `
            <span class="text-xs text-slate-400">
                সাধারণ সদস্য
            </span>
        `;

        if (rank === 1) {
            statusHTML = `
                <span class="text-xs font-semibold text-amber-700">
                    🥇 শীর্ষস্থান
                </span>
            `;
        } else if (rank === 2) {
            statusHTML = `
                <span class="text-xs font-semibold text-slate-600">
                    🥈 দ্বিতীয়
                </span>
            `;
        } else if (rank === 3) {
            statusHTML = `
                <span class="text-xs font-semibold text-orange-700">
                    🥉 তৃতীয়
                </span>
            `;
        } else if (isPenaltyUser) {
            statusHTML = `
                <span class="penalty-badge">
                    ⚠️ জরিমানার পর্যায়
                </span>
            `;
        }

        const row = document.createElement("tr");

        row.className = `
            ranking-row
            ${isCurrentUser ? "my-rank-row" : ""}
            ${isPenaltyUser ? "penalty-row" : ""}
        `;

        row.innerHTML = `
            <td class="font-semibold text-slate-500">
                <span class="inline-flex items-center justify-center
                             min-w-9 h-9 rounded-lg
                             ${rank === 1
                ? "bg-amber-100 text-amber-800"
                : rank === 2
                    ? "bg-slate-100 text-slate-700"
                    : rank === 3
                        ? "bg-orange-100 text-orange-800"
                        : "bg-slate-50 text-slate-500"
            }">
                    ${toBanglaNumber(rank)}
                </span>
            </td>

            <td>
                <div class="flex items-center min-w-0">
                    <div>
                        <p class="font-semibold text-slate-800
                                  break-words">
                            ${escapeHTML(user.name)}
                        </p>

                        ${isCurrentUser
                ? `<span class="text-xs font-semibold
                                                text-blue-600">
                                       আপনি
                                   </span>`
                : ""
            }
                    </div>
                </div>
            </td>

            <!-- মোট স্কোরের ঠিক আগে সাবমিট সংখ্যা -->
            <td class="text-right">
                <span class="font-semibold text-emerald-700">
                    ${toBanglaNumber(user.submitCount)}
                </span>
            </td>

            <!-- মোট স্কোর -->
            <td class="text-right">
                <span class="score-number font-bold text-slate-800">
                    ${formatScore(user.totalScore)}
                </span>
            </td>

            <!-- অবস্থান -->
            <td class="text-right">
                ${statusHTML}
            </td>
        `;

        rankingTableBody.appendChild(row);
    });
}


// ================================================
// CURRENT USER POSITION
// ================================================

function renderMyPosition(users) {
    const loggedInUser = getLoggedInUser();

    const loggedInEmail = String(
        loggedInUser?.email || ""
    ).toLowerCase();

    const currentUserIndex = users.findIndex(
        user => user.email.toLowerCase() === loggedInEmail
    );

    if (!loggedInEmail || currentUserIndex === -1) {
        myPositionSection.classList.add("hidden");
        return;
    }

    const user = users[currentUserIndex];

    const rank = currentUserIndex + 1;

    myPositionSection.classList.remove("hidden");

    myNameElement.textContent = user.name;

    myScoreElement.textContent = formatScore(user.totalScore);

    myPositionText.textContent =
        `আপনি বর্তমানে ${toBanglaNumber(rank)} নম্বর অবস্থানে আছেন।`;
}


// ================================================
// LAST THREE USERS / PENALTY ZONE
// ================================================

// function renderPenaltyZone(users) {
//     penaltyList.innerHTML = "";

//     // Top 3-কে কখনো জরিমানার পর্যায়ে দেখানো হবে না।
//     const eligibleUsers = users.slice(3);

//     const lastThreeUsers = eligibleUsers.slice(-3);

//     if (lastThreeUsers.length === 0) {
//         penaltySection.classList.add("hidden");
//         return;
//     }

//     penaltySection.classList.remove("hidden");

//     lastThreeUsers.forEach(user => {
//         const rank = users.indexOf(user) + 1;

//         const item = document.createElement("div");

//         item.className = "flex items-center justify-between gap-3 p-4";

//         item.innerHTML = `
//             <div class="flex items-center gap-3 min-w-0">
//                 <div class="w-10 h-10 shrink-0 rounded-full
//                             bg-red-100 flex items-center
//                             justify-center text-red-700 font-bold">
//                     ${toBanglaNumber(rank)}
//                 </div>

//                 <div class="min-w-0">
//                     <p class="font-semibold text-slate-800 break-words">
//                         ${escapeHTML(user.name)}
//                     </p>

//                     <p class="text-xs text-red-600 mt-1">
//                         ⚠️ জরিমানার পর্যায়ে
//                     </p>
//                 </div>
//             </div>

//             <div class="text-right shrink-0">
//                 <p class="score-number font-bold text-red-700">
//                     ${formatScore(user.totalScore)}
//                 </p>

//                 <p class="text-xs text-slate-400">
//                     মোট স্কোর
//                 </p>
//             </div>
//         `;

//         penaltyList.appendChild(item);
//     });
// }


// ================================================
// RENDER ALL SECTIONS
// ================================================

function renderRanking(users) {
    const rankedUsers = sortUsers(users);

    if (userCountElement) {
        userCountElement.textContent =
            toBanglaNumber(rankedUsers.length);
    }

    if (rankedUsers.length === 0) {
        if (emptyRanking) {
            emptyRanking.classList.remove("hidden");
        }

        if (podiumSection) {
            podiumSection.classList.add("hidden");
        }

        if (myPositionSection) {
            myPositionSection.classList.add("hidden");
        }

        if (penaltySection) {
            penaltySection.classList.add("hidden");
        }

        if (rankingTableBody) {
            rankingTableBody.innerHTML = "";
        }

        if (rankingMessage) {
            rankingMessage.textContent =
                "এখনো কোনো ইউজারের তথ্য পাওয়া যায়নি।";

            rankingMessage.classList.remove("hidden");
        }

        return;
    }

    if (emptyRanking) {
        emptyRanking.classList.add("hidden");
    }

    if (podiumSection) {
        podiumSection.classList.remove("hidden");
        renderPodium(rankedUsers);
    }

    if (rankingMessage) {
        rankingMessage.classList.add("hidden");
    }

    renderRankingTable(rankedUsers);
    renderMyPosition(rankedUsers);

    // জরিমানার অংশ প্রয়োজন হলে পরে চালু করা যাবে।
    // renderPenaltyZone(rankedUsers);
}


// ================================================
// LOAD LATEST DATA FROM JSONBIN
// পেজ খোলার সময় একবার ডেটা লোড হবে
// ================================================

async function loadRanking() {
    try {
        rankingMessage.textContent =
            "JSONBin থেকে সর্বশেষ স্কোর লোড হচ্ছে...";

        const response = await fetch(BIN_URL, {
            method: "GET",

            headers: {
                "X-Access-Key": ACCESS_KEY
            },

            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `JSONBin request failed: ${response.status}`
            );
        }

        const data = await response.json();

        const users = data?.record?.users;

        if (!Array.isArray(users)) {
            throw new Error(
                "JSONBin record-এর মধ্যে users array পাওয়া যায়নি।"
            );
        }

        renderRanking(users);

        lastUpdated.textContent =
            "আপডেট: " +
            new Date().toLocaleTimeString("bn-BD", {
                hour: "numeric",
                minute: "2-digit"
            });

    } catch (error) {
        console.error("Ranking load error:", error);

        rankingMessage.textContent =
            "র‍্যাংকিং লোড করা যায়নি। ইন্টারনেট, JSONBin URL এবং Access Key পরীক্ষা করো।";

        lastUpdated.textContent = "ডেটা লোড ব্যর্থ";
    }
}


// ================================================
// START
// পেজ খোলার সময় একবার ডেটা লোড হবে
// ================================================

loadRanking();