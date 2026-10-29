const registerForm = document.getElementById("registerForm");
const userName = document.getElementById('name');
const userEmail = document.getElementById('email');
const pwInput = document.getElementById('password');
const toggleBtn = document.getElementById('toggle-password');
const eyeOpen = document.getElementById('eye-open');
const eyeClosed = document.getElementById('eye-closed');

// ==========================================
// JSONBin
// ==========================================

// Toggle the show password
toggleBtn.addEventListener('click', () => {
    const showing = pwInput.type === 'text';
    pwInput.type = showing ? 'password' : 'text';
    eyeOpen.classList.toggle('hidden', !showing);
    eyeClosed.classList.toggle('hidden', showing);
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});




// ==========================================
// Registration
// ==========================================

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = userName.value.trim();
    const email = userEmail.value.trim().toLowerCase();
    const password = pwInput.value.trim();

    // Basic validation
    if (!name || !email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    try {

        // ------------------------------------------
        // 1. Get existing users from JSONBin
        // ------------------------------------------

        const response = await fetch(BIN_URL);

        if (!response.ok) {
            throw new Error("Could not get users.");
        }

        const data = await response.json();

        const users = data.record.users || [];


        // ------------------------------------------
        // 2. Check if email already exists
        // ------------------------------------------

        const existingUser = users.find(
            user => user.email.toLowerCase() === email
        );

        if (existingUser) {
            alert("This email is already registered.");
            return;
        }


        // ------------------------------------------
        // 3. Create new user ID
        // ------------------------------------------

        const newUserId = users.length > 0
            ? Math.max(...users.map(user => user.id)) + 1
            : 1;


        // ------------------------------------------
        // 4. Create new user
        // ------------------------------------------

        const newUser = {
            id: newUserId,
            name: name,
            email: email,
            password: password,

            // Give the user a fresh copy
            // of all 10 default tasks
            tasks: structuredClone(defaultTasks)
        };


        // ------------------------------------------
        // 5. Add new user to users array
        // ------------------------------------------

        users.push(newUser);


        // ------------------------------------------
        // 6. Save updated users to JSONBin
        // ------------------------------------------

        const updateResponse = await fetch(BIN_URL, {
            method: "PUT",

            headers: {
                "Content-Type": "application/json",
                "X-Access-Key": ACCESS_KEY
            },

            body: JSON.stringify({
                users: users
            })
        });


        if (!updateResponse.ok) {
            throw new Error("Could not save the new user.");
        }


        // ------------------------------------------
        // 7. Registration successful
        // ------------------------------------------

        alert("Registration successful!");

        registerForm.reset();

        // Go to dashboard
        window.location.href = "login.html";

    } catch (error) {

        console.error("Registration error:", error);

        alert("Something went wrong. Please try again.");

    }
});