// js/login.js

const pwInput = document.getElementById("password");
const toggleBtn = document.getElementById("toggle-password");
const eyeOpen = document.getElementById("eye-open");
const eyeClosed = document.getElementById("eye-closed");
const loginBtn = document.getElementById("login-btn");
const emailInput = document.getElementById("email");

// Password show / hide
if (toggleBtn && pwInput) {
    toggleBtn.addEventListener("click", () => {
        const showing = pwInput.type === "text";

        pwInput.type = showing ? "password" : "text";

        if (eyeOpen) eyeOpen.classList.toggle("hidden", !showing);
        if (eyeClosed) eyeClosed.classList.toggle("hidden", showing);

        toggleBtn.setAttribute(
            "aria-label",
            showing ? "Show password" : "Hide password"
        );
    });
}

// Login
if (loginBtn && emailInput && pwInput) {
    loginBtn.addEventListener("click", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim().toLowerCase();
        const password = pwInput.value;

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        loginBtn.disabled = true;

        try {
            const response = await fetch(BIN_URL, {
                headers: { "X-Access-Key": ACCESS_KEY }
            });

            if (!response.ok) {
                throw new Error(`JSONBin error: ${response.status}`);
            }

            const data = await response.json();
            const users = data.record?.users || [];

            const user = users.find(
                item => String(item.email || "").toLowerCase() === email
            );

            if (!user) {
                alert("User not found.");
                return;
            }

            if (user.password !== password) {
                alert("Incorrect password.");
                return;
            }

            // শুধু লগইন করা ইউজারের তথ্য সংরক্ষণ
            const loggedInUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                tasks: user.tasks || []
            };

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(loggedInUser)
            );
            localStorage.setItem("loginTime", String(Date.now()));

            alert(`Welcome, ${user.name}!`);
            window.location.href = "../index.html";

        } catch (error) {
            console.error(error);
            alert("Login failed. Please check your connection and try again.");
        } finally {
            loginBtn.disabled = false;
        }
    });
}