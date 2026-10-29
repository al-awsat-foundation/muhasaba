
"use strict";

// ==========================================
// CURRENT USER
// ==========================================

function getCurrentUser() {
    try {
        return JSON.parse(
            localStorage.getItem("loggedInUser") || "null"
        );
    } catch (error) {
        console.error("Unable to read user data:", error);
        return null;
    }
}


// ==========================================
// HTML ELEMENTS
// ==========================================

const userName = document.getElementById("userName");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const totalScoreValue = document.getElementById("totalScoreValue");


// ==========================================
// CONFIGURATION
// ==========================================

const SCORE_REFRESH_INTERVAL = 30 * 1000;

let scoreRefreshTimer = null;
let isScoreRefreshing = false;


// ==========================================
// CALCULATE TOTAL SCORE
// ==========================================

function calculateTotalScore(user) {
    if (!user || !Array.isArray(user.tasks)) {
        return 0;
    }

    return user.tasks.reduce((total, task) => {
        const score = Number(task.score);

        return total + (
            Number.isFinite(score) ? score : 0
        );
    }, 0);
}


// ==========================================
// FORMAT SCORE
// ==========================================

function formatScore(score) {
    return Number(score || 0).toFixed(1);
}


// ==========================================
// UPDATE NAVBAR
// ==========================================

function updateNavbar() {
    const user = getCurrentUser();
    const isLoggedIn = Boolean(user?.email);

    if (loginButton) {
        loginButton.classList.toggle("hidden", isLoggedIn);
    }

    if (logoutButton) {
        logoutButton.classList.toggle("hidden", !isLoggedIn);
    }

    if (userName) {
        userName.textContent = isLoggedIn
            ? (user.name || "")
            : "";
    }

    if (totalScoreValue) {
        totalScoreValue.textContent = isLoggedIn
            ? formatScore(calculateTotalScore(user))
            : "0.0";
    }

    return user;
}


// ==========================================
// REFRESH CURRENT USER SCORE FROM JSONBIN
// ==========================================

async function refreshTotalScore() {
    const currentUser = getCurrentUser();

    if (!currentUser?.email) {
        updateNavbar();
        return;
    }

    // Prevent overlapping requests.
    if (isScoreRefreshing) return;

    // Check JSONBin configuration.
    if (
        typeof BIN_URL === "undefined" ||
        typeof ACCESS_KEY === "undefined"
    ) {
        console.error(
            "BIN_URL বা ACCESS_KEY পাওয়া যায়নি। config.js পরীক্ষা করো।"
        );
        return;
    }

    isScoreRefreshing = true;

    try {
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
                "JSONBin-এ users array পাওয়া যায়নি।"
            );
        }

        // Find only the currently logged-in user.
        const email = String(currentUser.email)
            .trim()
            .toLowerCase();

        const remoteUser = users.find(user =>
            String(user.email || "")
                .trim()
                .toLowerCase() === email
        );

        if (!remoteUser) {
            console.warn(
                "বর্তমান ইউজার JSONBin-এ পাওয়া যায়নি।"
            );
            return;
        }

        // Check whether the user logged out during the request.
        const latestUser = getCurrentUser();

        if (
            !latestUser?.email ||
            String(latestUser.email).trim().toLowerCase() !== email
        ) {
            updateNavbar();
            return;
        }

        // Update only the current user's local data.
        const updatedUser = {
            ...latestUser,
            ...remoteUser
        };

        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(updatedUser)
        );

        // Update name and total score.
        if (userName) {
            userName.textContent = updatedUser.name || "";
        }

        if (totalScoreValue) {
            totalScoreValue.textContent = formatScore(
                calculateTotalScore(updatedUser)
            );
        }

    } catch (error) {
        console.error("Total score update error:", error);
    } finally {
        isScoreRefreshing = false;
    }
}


// ==========================================
// LOG OUT
// ==========================================

if (logoutButton) {
    logoutButton.addEventListener("click", event => {
        event.preventDefault();

        if (scoreRefreshTimer !== null) {
            clearInterval(scoreRefreshTimer);
            scoreRefreshTimer = null;
        }

        localStorage.removeItem("loggedInUser");

        window.location.href = "./pages/login.html";
    });
}


// ==========================================
// ANIMATE SCORE (OPTIONAL)
// ==========================================

function animateScore(element, target) {
    if (!element) return;

    const duration = 1200;
    const startTime = performance.now();
    const finalScore = Number(target) || 0;

    function update(currentTime) {
        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        element.textContent = formatScore(
            finalScore * progress
        );

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}


// ==========================================
// INITIALIZE APP
// ==========================================

// Show current local data immediately.
updateNavbar();

// Fetch the latest score from JSONBin.
refreshTotalScore();

// Refresh every 30 seconds.
scoreRefreshTimer = setInterval(
    refreshTotalScore,
    SCORE_REFRESH_INTERVAL
);
