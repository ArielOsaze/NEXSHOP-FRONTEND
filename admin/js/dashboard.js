// ================================
// NexShop Dashboard
// ================================

const token = localStorage.getItem("token");
const API_BASE = "https://nexshop-backend-production.up.railway.app/api";

if (!token) {
    window.location.href = "login.html";
}

let products = [];
let editingId = null;
let currentImage = "";
let ordersLoaded = false;
let usersLoaded = false;
let promoLoaded = false;

const productModalEl = document.getElementById("productModal");
const productModal = new bootstrap.Modal(productModalEl);
const previewImage = document.getElementById("previewImage");
const imageInput = document.getElementById("image");

const promoModalEl = document.getElementById("promoModal");
const promoModal = new bootstrap.Modal(promoModalEl);
let editingPromoId = null;

// ================================
// Helpers
// ================================

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function showToast(message, isError = false) {
    const toastEl = document.getElementById("liveToast");
    document.getElementById("toastMessage").textContent = message;
    toastEl.classList.remove("text-bg-danger", "text-bg-success");
    toastEl.classList.add(isError ? "text-bg-danger" : "text-bg-success");
    new bootstrap.Toast(toastEl).show();
}

// Central fetch wrapper: always attaches the token and handles expired sessions
// in one place, instead of every function repeating Authorization headers.
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: "Bearer " + token
        }
    });

    if (res.status === 401) {
        localStorage.removeItem("token");
        showToast("Sesi kamu berakhir, silakan login kembali.", true);
        setTimeout(() => window.location.href = "login.html", 1200);
        throw new Error("unauthorized");
    }

    return res;
}

// ================================
// View switching (sidebar)
// ================================

document.querySelectorAll("#sidebarNav .nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll("#sidebarNav .nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        const view = link.dataset.view;
        document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("d-none"));
        document.getElementById(`view-${view}`).classList.remove("d-none");

        if (view === "orders" && !ordersLoaded) loadOrders();
        if (view === "users" && !usersLoaded) loadUsers();
        if (view === "promo" && !promoLoaded) loadPromo();
    });
});

// ================================
// Load Products
// ================================

async function loadProducts() {
    const tbody = document.getElementById("products");
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Memuat data...</td></tr>`;

    try {
        const res = await apiFetch("/products");
        if (!res.ok) throw new Error("Gagal mengambil data produk");

        products = await res.json();
        renderProducts(products);
        updateStats(products);

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${escapeHtml(err.message)}</td></tr>`;
        showToast(err.message, true);
    }
}

// ================================
// Render Table
// ================================

function renderProducts(data) {
    const tbody = document.getElementById("products");

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada produk.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(product => `
        <tr>
            <td>${escapeHtml(product.id)}</td>
            <td>
                ${product.image
                    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" style="width:70px;height:70px;object-fit:cover;border-radius:10px;">`
                    : "-"}
            </td>
            <td><strong>${escapeHtml(product.name)}</strong></td>
            <td>Rp ${Number(product.price).toLocaleString("id-ID")}</td>
            <td><span class="badge bg-primary">${escapeHtml(product.badge || "-")}</span></td>
            <td>${escapeHtml(product.category || "-")}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="editProduct(${Number(product.id)})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${Number(product.id)})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

// ================================
// Statistik
// ================================

function updateStats(data) {
    let totalHarga = 0;
    let totalSold = 0;

    data.forEach(item => {
        totalHarga += Number(item.price || 0);
        totalSold += Number(item.sold || 0);
    });

    document.getElementById("totalProduk").innerText = data.length;
    document.getElementById("totalSold").innerText = totalSold;
    document.getElementById("totalHarga").innerText = "Rp " + totalHarga.toLocaleString("id-ID");
}

// ================================
// Search
// ================================

const search = document.getElementById("search");

if (search) {
    search.addEventListener("keyup", () => {
        const keyword = search.value.toLowerCase();
        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(keyword) ||
            (product.category || "").toLowerCase().includes(keyword) ||
            (product.badge || "").toLowerCase().includes(keyword)
        );
        renderProducts(filtered);
    });
}

// ================================
// Image preview
// ================================

if (imageInput) {
    imageInput.addEventListener("change", () => {
        const file = imageInput.files[0];
        if (!file) {
            previewImage.src = "";
            previewImage.classList.add("d-none");
            return;
        }
        previewImage.src = URL.createObjectURL(file);
        previewImage.classList.remove("d-none");
    });
}

// ================================
// Description field: guard against Enter being intercepted
// by any outer key handler, so a normal newline always goes through.
// ================================

const descriptionField = document.getElementById("description");
if (descriptionField) {
    descriptionField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.stopPropagation();
        }
    });
}

// ================================
// Delete
// ================================

async function deleteProduct(id) {
    if (!confirm("Hapus produk ini?")) return;

    try {
        const res = await apiFetch(`/products/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.message || "Gagal menghapus produk");

        showToast(data.message || "Produk berhasil dihapus");
        loadProducts();

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        showToast(err.message, true);
    }
}

// ================================
// Edit
// ================================

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    editingId = id;
    currentImage = product.image || "";

    document.getElementById("modalTitle").innerHTML = '<i class="bi bi-box-seam me-2"></i>Edit Produk';

    document.getElementById("name").value = product.name;
    document.getElementById("price").value = product.price;
    document.getElementById("badge").value = product.badge || "";
    document.getElementById("category").value = product.category || "";
    document.getElementById("rating").value = product.rating || "";
    document.getElementById("sold").value = product.sold || "";
    document.getElementById("description").value = product.description || "";

    if (product.image) {
        previewImage.src = product.image;
        previewImage.classList.remove("d-none");
    }

    productModal.show();
}

// Reset the form EVERY time the modal closes — whether by Save, Cancel, the
// X button, or clicking outside. Previously this only happened after a
// successful save, so cancelling an edit and then clicking "Tambah Produk"
// would silently reopen the form still in "edit" mode with the old data.
productModalEl.addEventListener("hidden.bs.modal", () => {
    document.getElementById("productForm").reset();
    previewImage.src = "";
    previewImage.classList.add("d-none");
    editingId = null;
    currentImage = "";
    document.getElementById("modalTitle").innerHTML = '<i class="bi bi-box-seam me-2"></i>Tambah Produk';
});

// ================================
// Save Product
// ================================

async function saveProduct() {
    const form = document.getElementById("productForm");
    if (!form.reportValidity()) return; // now actually enforced, since Save used to bypass native validation

    const price = Number(document.getElementById("price").value);
    if (!price || price <= 0) {
        showToast("Harga harus lebih dari 0", true);
        return;
    }

    const saveBtn = document.getElementById("saveProductBtn");
    const originalHtml = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...`;

    try {
        const imageFile = imageInput.files[0];
        let imageUrl = currentImage;

        if (imageFile) {
            const formData = new FormData();
            formData.append("image", imageFile);

            // Fixed: this request was previously sent without the auth token,
            // which fails if the backend requires it for uploads.
            const uploadRes = await apiFetch("/upload", { method: "POST", body: formData });
            const uploadData = await uploadRes.json().catch(() => ({}));

            if (!uploadRes.ok) throw new Error(uploadData.message || "Upload gambar gagal");
            imageUrl = uploadData.url;
        }

        const product = {
            name: document.getElementById("name").value.trim(),
            price,
            badge: document.getElementById("badge").value.trim(),
            category: document.getElementById("category").value.trim(),
            rating: Number(document.getElementById("rating").value || 0),
            sold: Number(document.getElementById("sold").value || 0),
            image: imageUrl,
            description: document.getElementById("description").value
        };

        const url = editingId ? `/products/${editingId}` : "/products";
        const method = editingId ? "PUT" : "POST";

        const res = await apiFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(product)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Gagal menyimpan produk");

        productModal.hide(); // triggers the hidden.bs.modal reset above
        loadProducts();
        showToast("Produk berhasil disimpan");

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        showToast(err.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
    }
}

// ================================
// Orders (waiting on backend endpoint)
// ================================

async function loadOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = `<div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Memuat...</div>`;

    try {
        const res = await apiFetch("/orders");
        if (!res.ok) throw new Error("not-available");

        const orders = await res.json();
        ordersLoaded = true;

        if (!orders.length) {
            container.innerHTML = `<p class="text-muted text-center py-5 mb-0">Belum ada pesanan.</p>`;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead><tr><th>ID</th><th>Pelanggan</th><th>Total</th><th>Status</th><th>Tanggal</th></tr></thead>
                <tbody>
                    ${orders.map(o => `
                        <tr>
                            <td>${escapeHtml(o.id)}</td>
                            <td>${escapeHtml(o.customerName || o.name || "-")}</td>
                            <td>Rp ${Number(o.total || 0).toLocaleString("id-ID")}</td>
                            <td><span class="badge bg-info">${escapeHtml(o.status || "-")}</span></td>
                            <td>${o.date ? new Date(o.date).toLocaleDateString("id-ID") : "-"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            </div>
        `;
    } catch (err) {
        if (err.message === "unauthorized") return;
        // Expected for now — the backend doesn't have this endpoint yet.
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-cart-x display-4 d-block mb-3"></i>
                Fitur Orders belum terhubung ke backend.<br>
                <small>Endpoint <code>GET /orders</code> belum tersedia di API kamu.</small>
            </div>
        `;
    }
}

// ================================
// Users (waiting on backend endpoint)
// ================================

async function loadUsers() {
    const container = document.getElementById("usersContainer");
    container.innerHTML = `<div class="text-center text-muted py-5"><span class="spinner-border spinner-border-sm me-2"></span>Memuat...</div>`;

    try {
        const res = await apiFetch("/users");
        if (!res.ok) throw new Error("not-available");

        const users = await res.json();
        usersLoaded = true;

        if (!users.length) {
            container.innerHTML = `<p class="text-muted text-center py-5 mb-0">Belum ada pengguna.</p>`;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead><tr><th>ID</th><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${escapeHtml(u.id)}</td>
                            <td>${escapeHtml(u.name || "-")}</td>
                            <td>${escapeHtml(u.email || "-")}</td>
                            <td>
                                <select class="form-select form-select-sm" style="width:110px;" onchange="changeUserRole(${Number(u.id)}, this.value)">
                                    <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
                                    <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                                </select>
                            </td>
                            <td>
                                ${u.is_blacklisted
                                    ? `<span class="badge bg-danger">Diblokir</span>`
                                    : `<span class="badge bg-success">Aktif</span>`}
                            </td>
                            <td>
                                <button class="btn btn-sm ${u.is_blacklisted ? "btn-success" : "btn-outline-danger"}"
                                        onclick="toggleUserBlacklist(${Number(u.id)}, ${!u.is_blacklisted})">
                                    <i class="bi ${u.is_blacklisted ? "bi-unlock" : "bi-slash-circle"}"></i>
                                    ${u.is_blacklisted ? "Buka Blokir" : "Blokir"}
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            </div>
        `;
    } catch (err) {
        if (err.message === "unauthorized") return;
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-people display-4 d-block mb-3"></i>
                Fitur Users belum terhubung ke backend.<br>
                <small>Endpoint <code>GET /users</code> belum tersedia di API kamu.</small>
            </div>
        `;
    }
}

async function changeUserRole(id, role) {
    try {
        const res = await apiFetch(`/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Gagal mengubah role");

        showToast(`Role berhasil diubah jadi "${role}"`);
    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        showToast(err.message, true);
        loadUsers(); // refresh biar dropdown balik ke nilai asli kalau gagal
    }
}

async function toggleUserBlacklist(id, newValue) {
    const confirmMsg = newValue
        ? "Blokir akun ini? User gak akan bisa login sampai dibuka blokirnya lagi."
        : "Buka blokir akun ini?";
    if (!confirm(confirmMsg)) return;

    try {
        const res = await apiFetch(`/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_blacklisted: newValue })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Gagal mengubah status user");

        showToast(newValue ? "Akun berhasil diblokir" : "Blokir berhasil dibuka");
        loadUsers();
    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        showToast(err.message, true);
    }
}

// ================================
// Promo / Iklan / Berita (carousel slides)
// ================================

let promoSlides = [];

async function loadPromo() {
    const tbody = document.getElementById("promoSlides");
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Memuat data...</td></tr>`;

    try {
        const res = await apiFetch("/promo/all");
        if (!res.ok) throw new Error("Gagal mengambil data promo");

        promoSlides = await res.json();
        promoLoaded = true;
        renderPromoSlides();

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderPromoSlides() {
    const tbody = document.getElementById("promoSlides");

    if (!promoSlides.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada slide. Klik "Tambah Slide" buat mulai.</td></tr>`;
        return;
    }

    tbody.innerHTML = promoSlides.map(slide => `
        <tr>
            <td>${escapeHtml(slide.sort_order ?? 0)}</td>
            <td><span class="badge bg-secondary text-capitalize">${escapeHtml(slide.type || "promo")}</span></td>
            <td><strong>${escapeHtml(slide.title)}</strong></td>
            <td>
                ${slide.is_active
                    ? `<span class="badge bg-success">Aktif</span>`
                    : `<span class="badge bg-secondary">Nonaktif</span>`}
            </td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="editPromoSlide(${Number(slide.id)})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deletePromoSlide(${Number(slide.id)})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");
}

function openPromoModal() {
    editingPromoId = null;
    document.getElementById("promoForm").reset();
    document.getElementById("promoIsActive").checked = true;
    document.getElementById("promoModalTitle").innerHTML = '<i class="bi bi-megaphone me-2"></i>Tambah Slide';
    document.getElementById("promoError").textContent = "";
    promoModal.show();
}

function editPromoSlide(id) {
    const slide = promoSlides.find(s => s.id === id);
    if (!slide) return;

    editingPromoId = id;
    document.getElementById("promoModalTitle").innerHTML = '<i class="bi bi-megaphone me-2"></i>Edit Slide';
    document.getElementById("promoType").value = slide.type || "promo";
    document.getElementById("promoSortOrder").value = slide.sort_order ?? 0;
    document.getElementById("promoBadge").value = slide.badge_text || "";
    document.getElementById("promoTitle").value = slide.title || "";
    document.getElementById("promoDesc").value = slide.description || "";
    document.getElementById("promoCtaText").value = slide.cta_text || "";
    document.getElementById("promoCtaLink").value = slide.cta_link || "";
    document.getElementById("promoImageUrl").value = slide.image_url || "";
    document.getElementById("promoIsActive").checked = !!slide.is_active;
    document.getElementById("promoError").textContent = "";
    promoModal.show();
}

async function savePromo() {
    const title = document.getElementById("promoTitle").value.trim();
    const errorEl = document.getElementById("promoError");

    if (!title) {
        errorEl.textContent = "Judul wajib diisi";
        return;
    }

    const saveBtn = document.getElementById("savePromoBtn");
    const originalHtml = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Menyimpan...`;

    const payload = {
        type: document.getElementById("promoType").value,
        sort_order: Number(document.getElementById("promoSortOrder").value || 0),
        badge_text: document.getElementById("promoBadge").value.trim(),
        title,
        description: document.getElementById("promoDesc").value.trim(),
        cta_text: document.getElementById("promoCtaText").value.trim(),
        cta_link: document.getElementById("promoCtaLink").value.trim(),
        image_url: document.getElementById("promoImageUrl").value.trim(),
        is_active: document.getElementById("promoIsActive").checked
    };

    try {
        const url = editingPromoId ? `/promo/${editingPromoId}` : "/promo";
        const method = editingPromoId ? "PUT" : "POST";

        const res = await apiFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Gagal menyimpan slide");

        promoModal.hide();
        loadPromo();
        showToast("Slide berhasil disimpan");

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        errorEl.textContent = err.message;
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
    }
}

async function deletePromoSlide(id) {
    if (!confirm("Hapus slide ini?")) return;

    try {
        const res = await apiFetch(`/promo/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.message || "Gagal menghapus slide");

        showToast(data.message || "Slide berhasil dihapus");
        loadPromo();

    } catch (err) {
        if (err.message === "unauthorized") return;
        console.error(err);
        showToast(err.message, true);
    }
}

// ================================
// Logout
// ================================

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ================================
loadProducts();
