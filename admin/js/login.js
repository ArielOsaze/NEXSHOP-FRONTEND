const API_BASE = "https://nexshop-backend-production.up.railway.app/api";

async function login() {

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Email dan Password wajib diisi!");
        return;
    }

    try {

        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Login gagal");
        }

        localStorage.setItem("token", data.token);

        alert("Login berhasil!");

        window.location.href = "dashboard.html";

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

}