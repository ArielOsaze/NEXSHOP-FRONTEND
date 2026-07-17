// ================================
// NexShop Dashboard v1
// ================================

const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

// ================================
// Global Data
// ================================

let products = [];
let editingId = null;
let currentImage = "";

// ================================
// Load Products
// ================================

async function loadProducts() {

    try {

        const res = await fetch("/api/products", {
            headers: {
                Authorization: "Bearer " + token
            }
        });

        if (!res.ok) {
            throw new Error("Gagal mengambil data produk");
        }

        products = await res.json();

        renderProducts(products);
        updateStats(products);

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

}

// ================================
// Render Table
// ================================

function renderProducts(data) {

    const tbody = document.getElementById("products");

    tbody.innerHTML = "";

    data.forEach(product => {

        tbody.innerHTML += `
            <tr>

               <td>${product.id}</td>

<td>
    ${
        product.image
            ? `<img
                src="${product.image}"
                alt="${product.name}"
                style="
                    width:70px;
                    height:70px;
                    object-fit:cover;
                    border-radius:10px;
                ">`
            : "-"
    }
</td>

<td>
    <strong>${product.name}</strong>
</td>

                <td>
                    Rp ${Number(product.price).toLocaleString("id-ID")}
                </td>

                <td>
                    <span class="badge bg-primary">
                        ${product.badge || "-"}
                    </span>
                </td>

                <td>
                    ${product.category || "-"}
                </td>

                <td>

                    <button
                        class="btn btn-warning btn-sm"
                        onclick="editProduct(${product.id})">

                        <i class="bi bi-pencil"></i>

                    </button>

                    <button
                        class="btn btn-danger btn-sm"
                        onclick="deleteProduct(${product.id})">

                        <i class="bi bi-trash"></i>

                    </button>

                </td>

            </tr>
        `;

    });

}

// ================================
// Statistik
// ================================

function updateStats(data){

    let totalHarga = 0;
    let totalSold = 0;

    data.forEach(item=>{

        totalHarga += Number(item.price || 0);
        totalSold += Number(item.sold || 0);

    });

    document.getElementById("totalProduk").innerHTML = data.length;

    document.getElementById("totalSold").innerHTML = totalSold;

    document.getElementById("totalHarga").innerHTML =
        "Rp " + totalHarga.toLocaleString("id-ID");

}

// ================================
// Search
// ================================

const search = document.getElementById("search");

const imageInput = document.getElementById("image");
const previewImage = document.getElementById("previewImage");

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

if(search){

search.addEventListener("keyup",()=>{

    const keyword = search.value.toLowerCase();

    const filtered = products.filter(product=>{

        return (
            product.name.toLowerCase().includes(keyword) ||
            (product.category || "").toLowerCase().includes(keyword) ||
            (product.badge || "").toLowerCase().includes(keyword)
        );

    });

    renderProducts(filtered);

});

}

// ================================
// Delete
// ================================

async function deleteProduct(id){

    if(!confirm("Hapus produk ini?")) return;

    try{

        const res = await fetch("/api/products/"+id,{

            method:"DELETE",

            headers:{
                Authorization:"Bearer "+token
            }

        });

        const data = await res.json();

        alert(data.message);

        loadProducts();

    }catch(err){

        console.error(err);

    }

}

// ================================
// Edit
// ================================

function editProduct(id){

    const product = products.find(p => p.id === id);

    if(!product) return;

    editingId = id;
    currentImage = product.image || "";

    document.getElementById("modalTitle").innerText = "Edit Produk";

    document.getElementById("name").value = product.name;
    document.getElementById("price").value = product.price;
    document.getElementById("badge").value = product.badge || "";
    document.getElementById("category").value = product.category || "";
    document.getElementById("rating").value = product.rating || "";
    document.getElementById("sold").value = product.sold || "";
    document.getElementById("description").value = product.description || "";

    if(product.image){
        previewImage.src = product.image;
        previewImage.classList.remove("d-none");
    }

    new bootstrap.Modal(
        document.getElementById("productModal")
    ).show();

}

// ================================
// Save Product
// ================================

async function saveProduct() {

    try {

        const imageFile = document.getElementById("image").files[0];

        let imageUrl = currentImage;

        // Upload gambar
        if (imageFile) {

            const formData = new FormData();
            formData.append("image", imageFile);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) {
                throw new Error(uploadData.message || "Upload gambar gagal");
            }

            imageUrl = uploadData.url;
        }

        const product = {
            name: document.getElementById("name").value,
            price: Number(document.getElementById("price").value),
            badge: document.getElementById("badge").value,
            category: document.getElementById("category").value,
            rating: Number(document.getElementById("rating").value || 0),
            sold: Number(document.getElementById("sold").value || 0),
            image: imageUrl,
            description: document.getElementById("description").value
        };

        if (!product.name || !product.price) {
            alert("Nama dan Harga wajib diisi!");
            return;
        }

        const url = editingId
    ? "/api/products/" + editingId
    : "/api/products";

const method = editingId
    ? "PUT"
    : "POST";

const res = await fetch(url, {
    method,
    headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
    },
    body: JSON.stringify(product)
});

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Gagal menyimpan produk");
        }

        bootstrap.Modal
            .getInstance(document.getElementById("productModal"))
            .hide();

       document.getElementById("productForm").reset();

previewImage.src = "";
previewImage.classList.add("d-none");

editingId = null;
currentImage = "";

document.getElementById("modalTitle").innerText = "Tambah Produk";

loadProducts();

document.getElementById("toastMessage").textContent =
    "Produk berhasil disimpan";

        new bootstrap.Toast(
            document.getElementById("liveToast")
        ).show();

    } catch (err) {

        console.error(err);
        alert(err.message);

    }

}

// ================================
// Logout
// ================================

function logout(){

    localStorage.removeItem("token");

    window.location.href="login.html";

}

// ================================

loadProducts();