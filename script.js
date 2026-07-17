/* =========================================================
   NexShop — front-end store logic
   Data is persisted in localStorage. There is no real backend,
   so "login" and "checkout" are simulated for demo purposes.
   ========================================================= */

let PRODUCTS = [];
let selectedCategory = "Semua";

const API_BASE = "https://nexshop-backend-production.up.railway.app/api";

const rupiah = (n) => "Rp" + n.toLocaleString("id-ID");
const stars = (rating) => "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

/* ---------- State (persisted) ---------- */
let cart = JSON.parse(localStorage.getItem("nexshop_cart") || "[]");
let currentUser = JSON.parse(localStorage.getItem("nexshop_user") || "null");
let activeProductId = null;
let pendingQty = 1;

const saveCart = () => localStorage.setItem("nexshop_cart", JSON.stringify(cart));
const saveUser = () => localStorage.setItem("nexshop_user", JSON.stringify(currentUser));

/* ---------- Toast ---------- */
function toast(message, type = "default") {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = "toast" + (type !== "default" ? " " + type : "");
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

/* ---------- Overlay helpers ---------- */
function openOverlay(id) {
    document.getElementById(id).classList.add("active");
    document.body.style.overflow = "hidden";
}
function closeOverlay(id) {
    document.getElementById(id).classList.remove("active");
    document.body.style.overflow = "";
}
document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeOverlay(btn.dataset.close));
});
document.querySelectorAll(".overlay").forEach(ov => {
    ov.addEventListener("click", (e) => {
        if (e.target === ov) closeOverlay(ov.id);
    });
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".overlay.active").forEach(ov => closeOverlay(ov.id));
        document.getElementById("accountDropdown").classList.remove("active");
    }
});

/* ---------- Render product catalog ---------- */

async function loadProducts() {

    try {

        const res = await fetch(`${API_BASE}/products`);

     PRODUCTS = await res.json();

    renderCategories();
    renderProducts();

    } catch (err) {

        console.error(err);

    }

}
function renderCategories() {

    const filter = document.getElementById("categoryFilter");

    const categories = [
        "Semua",
        ...new Set(PRODUCTS.map(p => p.category))
    ];

    filter.innerHTML = categories.map(cat => `
        <button
            class="category-btn ${cat === selectedCategory ? "active" : ""}"
            data-category="${cat}">
            ${cat}
        </button>
    `).join("");

    filter.querySelectorAll(".category-btn").forEach(btn => {

        btn.onclick = () => {

            selectedCategory = btn.dataset.category;

            renderCategories();

            renderProducts();

        };

    });

}

function renderProducts() {
  
    const grid = document.getElementById("cardGrid");
   const data =
    selectedCategory === "Semua"
        ? PRODUCTS
        : PRODUCTS.filter(p => p.category === selectedCategory);

grid.style.opacity = 0;
grid.style.transform = "translateY(20px)";

setTimeout(() => {

    grid.innerHTML = data.map(p => `

        <div class="card" data-id="${p.id}">
            <div class="card-img">
                <img src="${p.image}" alt="${p.name}">
                <span class="badge">${p.badge}</span>
            </div>
            <div class="card-body">
                <h4>${p.name}</h4>
                <div class="card-rating"><span class="stars">${stars(p.rating)}</span> ${p.rating} · ${p.sold} terjual</div>
                <div class="card-footer">
                    <span class="card-price">${rupiah(p.price)}</span>
                    <button type="button" class="add-btn" data-id="${p.id}">Beli</button>
                </div>
            </div>
        </div>
    `).join("");

    grid.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".add-btn")) return; // handled separately
            openProductModal(Number(card.dataset.id));
        });
    });

    grid.querySelectorAll(".add-btn").forEach(btn => {
            grid.style.opacity = 1;
    grid.style.transform = "translateY(0)";

},150);
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToCart(Number(btn.dataset.id), 1);
        });
    });
}

/* ---------- Product detail modal ---------- */
function openProductModal(id) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p) return;
    activeProductId = id;
    pendingQty = 1;

    document.getElementById("pmImage").src = p.image;
    document.getElementById("pmImage").alt = p.name;
    document.getElementById("pmBadge").textContent = p.badge;
    document.getElementById("pmTitle").textContent = p.name;
    document.getElementById("pmStars").innerHTML = `<span class="stars">${stars(p.rating)}</span> ${p.rating}`;
    document.getElementById("pmSold").textContent = `· ${p.sold} terjual`;
  document.getElementById("pmDesc").textContent = p.description;
    document.getElementById("pmPrice").textContent = rupiah(p.price);
    document.getElementById("pmQtyValue").textContent = pendingQty;

    openOverlay("productOverlay");
}

document.getElementById("pmQtyMinus").addEventListener("click", () => {
    pendingQty = Math.max(1, pendingQty - 1);
    document.getElementById("pmQtyValue").textContent = pendingQty;
});
document.getElementById("pmQtyPlus").addEventListener("click", () => {
    pendingQty = Math.min(99, pendingQty + 1);
    document.getElementById("pmQtyValue").textContent = pendingQty;
});
document.getElementById("pmAddBtn").addEventListener("click", () => {
    addToCart(activeProductId, pendingQty);
    closeOverlay("productOverlay");
});

/* ---------- Cart logic ---------- */
function addToCart(id, qty) {
    const existing = cart.find(item => item.id === id);
    if (existing) existing.qty += qty;
    else cart.push({ id, qty });
    saveCart();
    updateCartCount();
    const p = PRODUCTS.find(x => x.id === id);
    toast(`${p.name} ditambahkan ke keranjang`, "success");
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById("cartCount").textContent = count;
}

function renderCart() {
    const container = document.getElementById("cartItems");
    if (cart.length === 0) {
        container.innerHTML = `<div class="cart-empty">Keranjang kamu masih kosong.<br>Yuk pilih game favoritmu!</div>`;
        document.getElementById("cartTotal").textContent = rupiah(0);
        return;
    }

    container.innerHTML = cart.map(item => {
        const p = PRODUCTS.find(x => x.id === item.id);
        return `
            <div class="cart-item" data-id="${p.id}">
                <img src="${p.image}" alt="${p.name}">
                <div class="cart-item-info">
                    <h5>${p.name}</h5>
                    <div class="cart-item-price">${rupiah(p.price * item.qty)}</div>
                    <div class="cart-item-controls">
                        <button type="button" class="qty-minus">−</button>
                        <span>${item.qty}</span>
                        <button type="button" class="qty-plus">+</button>
                        <button type="button" class="cart-item-remove">Hapus</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    const total = cart.reduce((sum, item) => {
        const p = PRODUCTS.find(x => x.id === item.id);
        return sum + p.price * item.qty;
    }, 0);
    document.getElementById("cartTotal").textContent = rupiah(total);

    container.querySelectorAll(".cart-item").forEach(row => {
        const id = Number(row.dataset.id);
        row.querySelector(".qty-plus").addEventListener("click", () => changeQty(id, 1));
        row.querySelector(".qty-minus").addEventListener("click", () => changeQty(id, -1));
        row.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(id));
    });
}

function changeQty(id, delta) {
    const item = cart.find(x => x.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(x => x.id !== id);
    saveCart();
    updateCartCount();
    renderCart();
}

function removeFromCart(id) {
    cart = cart.filter(x => x.id !== id);
    saveCart();
    updateCartCount();
    renderCart();
}

document.getElementById("cartBtn").addEventListener("click", () => {
    renderCart();
    openOverlay("cartOverlay");
});

/* ---------- Auth ---------- */
const accountBtn = document.getElementById("accountBtn");
const accountDropdown = document.getElementById("accountDropdown");

function refreshAccountUI() {
    if (currentUser) {
        accountBtn.textContent = currentUser.fullname.split(" ")[0];
        accountBtn.classList.add("logged-in");
        document.getElementById("accountAvatar").textContent = currentUser.fullname.charAt(0).toUpperCase();
        document.getElementById("accountName").textContent = currentUser.fullname;
        document.getElementById("accountEmail").textContent = currentUser.email;
    } else {
        accountBtn.textContent = "Login";
        accountBtn.classList.remove("logged-in");
    }
}

accountBtn.addEventListener("click", () => {
    if (currentUser) {
        accountDropdown.classList.toggle("active");
    } else {
        openOverlay("authOverlay");
    }
});

document.addEventListener("click", (e) => {
    if (!accountDropdown.contains(e.target) && e.target !== accountBtn) {
        accountDropdown.classList.remove("active");
    }
});

document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const isLogin = tab.dataset.tab === "login";
        document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
        document.getElementById("registerForm").classList.toggle("hidden", isLogin);
    });
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullname = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const password = document.getElementById("regPassword").value;
    const errorEl = document.getElementById("regError");

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullname, email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message;
            return;
        }
        errorEl.textContent = "";
        toast(`Akun berhasil dibuat. Silakan masuk, ${fullname}!`, "success");
        document.querySelector('[data-tab="login"]').click();
        e.target.reset();
    } catch (err) {
        errorEl.textContent = "Gagal terhubung ke server.";
    }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message;
            return;
        }
        localStorage.setItem("nexshop_token", data.token);
        currentUser = data.user;
        saveUser();
        refreshAccountUI();
        closeOverlay("authOverlay");
        toast(`Berhasil masuk. Selamat datang kembali, ${data.user.fullname}!`, "success");
        e.target.reset();
    } catch (err) {
        errorEl.textContent = "Gagal terhubung ke server.";
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    currentUser = null;
    saveUser();
    localStorage.removeItem("nexshop_token");
    refreshAccountUI();
    accountDropdown.classList.remove("active");
    toast("Kamu berhasil keluar.");
});

document.getElementById("myOrdersBtn").addEventListener("click", async () => {
    accountDropdown.classList.remove("active");
    const token = localStorage.getItem("nexshop_token");

    try {
        const res = await fetch(`${API_BASE}/orders/my`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const orders = await res.json();

        if (!res.ok || orders.length === 0) {
            toast("Belum ada pesanan.");
        } else {
            toast(`Kamu punya ${orders.length} pesanan tercatat.`);
        }
    } catch (err) {
        toast("Gagal mengambil data pesanan.", "error");
    }
});

/* ---------- Checkout ---------- */
document.getElementById("checkoutBtn").addEventListener("click", () => {
    if (cart.length === 0) {
        toast("Keranjang masih kosong.", "error");
        return;
    }
    if (!currentUser) {
        toast("Silakan login dulu untuk checkout.", "error");
        closeOverlay("cartOverlay");
        openOverlay("authOverlay");
        return;
    }
    closeOverlay("cartOverlay");

    if (currentUser) {
        document.getElementById("checkoutName").value = currentUser.fullname;
        document.getElementById("checkoutEmail").value = currentUser.email;
    }

    const total = cart.reduce((sum, item) => {
        const p = PRODUCTS.find(x => x.id === item.id);
        return sum + p.price * item.qty;
    }, 0);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    document.getElementById("checkoutSummary").innerHTML = `
        <div class="row"><span>${itemCount} item</span><span>${rupiah(total)}</span></div>
        <div class="row total"><span>Total Bayar</span><span>${rupiah(total)}</span></div>
    `;

    document.getElementById("checkoutStep").classList.remove("hidden");
    document.getElementById("checkoutSuccess").classList.add("hidden");
    openOverlay("checkoutOverlay");
});

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const recipient_name = document.getElementById("checkoutName").value.trim();
    const recipient_email = document.getElementById("checkoutEmail").value.trim();
    const payment_method = document.getElementById("checkoutPayment").value;
    const token = localStorage.getItem("nexshop_token");

    const total = cart.reduce((sum, item) => {
        const p = PRODUCTS.find(x => x.id === item.id);
        return sum + p.price * item.qty;
    }, 0);

    try {
        const res = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ recipient_name, recipient_email, payment_method, items: cart, total })
        });
        const data = await res.json();

        if (!res.ok) {
            toast(data.message || "Gagal membuat pesanan", "error");
            return;
        }

        document.getElementById("checkoutSuccessMsg").textContent =
            `Terima kasih, ${recipient_name}! Pesanan kamu senilai ${rupiah(total)} sedang diproses via ${payment_method.toUpperCase()}.`;

        document.getElementById("checkoutStep").classList.add("hidden");
        document.getElementById("checkoutSuccess").classList.remove("hidden");

        cart = [];
        saveCart();
        updateCartCount();
    } catch (err) {
        toast("Gagal terhubung ke server.", "error");
    }
});

/* ---------- Mobile menu ---------- */
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");
menuToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", isOpen);
});
navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => navMenu.classList.remove("active"));
});

/* ---------- Init ---------- */
loadProducts();
updateCartCount();
refreshAccountUI();