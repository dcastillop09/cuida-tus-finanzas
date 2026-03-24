import {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc
} from "./firebase.js";

let expenses = [];

const categoryColors = {
    "Comida": "#8e44ad",
    "Transporte": "#e74c3c",
    "Entretenimiento": "#e67e22",
    "Remuneración": "#3498db",
    "Salud": "#2ecc71",
    "Vivienda": "#f1c40f"
};

const form = document.getElementById("expenseForm");
const searchInput = document.getElementById("searchInput");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");

const categoryChartCtx = document.getElementById("categoryChart").getContext("2d");
const balanceChartCtx = document.getElementById("balanceChart").getContext("2d");

// =======================
// NAVEGACIÓN DE TABS
// =======================
document.querySelectorAll("nav li").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll("nav li").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
        });

        const target = tab.getAttribute("data-tab");
        document.getElementById(target).classList.add("active");
    });
});

// =======================
// GRÁFICOS
// =======================
let categoryChart = new Chart(categoryChartCtx, {
    type: "doughnut",
    data: {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: []
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    color: "#fff"
                }
            }
        }
    }
});

let balanceChart = new Chart(balanceChartCtx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Saldo acumulado",
            data: [],
            borderColor: "#00e5a8",
            backgroundColor: "rgba(0, 229, 168, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#00e5a8"
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#fff"
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: "#fff"
                },
                grid: {
                    color: "rgba(255,255,255,0.08)"
                }
            },
            y: {
                ticks: {
                    color: "#fff"
                },
                grid: {
                    color: "rgba(255,255,255,0.08)"
                }
            }
        }
    }
});

// =======================
// REGISTRO
// =======================
registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Completa correo y contraseña");
        return;
    }

    if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Cuenta creada correctamente");
    } catch (error) {
        console.error(error);
        alert("Error al registrarte: " + error.message);
    }
});

// =======================
// LOGIN
// =======================
loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Completa correo y contraseña");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Sesión iniciada correctamente");
    } catch (error) {
        console.error(error);
        alert("Error al iniciar sesión: " + error.message);
    }
});

// =======================
// LOGOUT
// =======================
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        alert("Sesión cerrada");
    } catch (error) {
        console.error(error);
        alert("No se pudo cerrar sesión");
    }
});

// =======================
// GUARDAR MOVIMIENTO
// =======================
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        alert("Debes iniciar sesión");
        return;
    }

    const date = document.getElementById("date").value;
    const category = document.getElementById("category").value;
    const description = document.getElementById("description").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const payment = document.getElementById("payment").value;
    const type = document.getElementById("type").value;
    const notes = document.getElementById("notes").value.trim();

    if (!date || !category || !description || isNaN(amount) || amount <= 0) {
        alert("Completa correctamente los campos");
        return;
    }

    const data = {
        uid: user.uid,
        date,
        category,
        description,
        amount,
        payment,
        type,
        notes,
        createdAt: Date.now()
    };

    try {
        await addDoc(collection(db, "movimientos"), data);
        alert("Movimiento guardado correctamente");
        form.reset();
        await loadData();
        activateTab("history");
    } catch (error) {
        console.error(error);
        alert("Error al guardar el movimiento");
    }
});

// =======================
// CARGAR DATOS
// =======================
async function loadData() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const querySnapshot = await getDocs(collection(db, "movimientos"));
        expenses = [];

        querySnapshot.forEach((item) => {
            const data = item.data();

            if (data.uid === user.uid) {
                expenses.push({
                    id: item.id,
                    ...data
                });
            }
        });

        expenses.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            if (dateA !== dateB) return dateA - dateB;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        update();
    } catch (error) {
        console.error(error);
        alert("Error al cargar los datos");
    }
}

// =======================
// ELIMINAR MOVIMIENTO
// =======================
async function deleteExpense(id) {
    const confirmDelete = confirm("¿Seguro que quieres eliminar este movimiento?");
    if (!confirmDelete) return;

    try {
        await deleteDoc(doc(db, "movimientos", id));
        expenses = expenses.filter(expense => expense.id !== id);
        update();
        alert("Movimiento eliminado");
    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el movimiento");
    }
}

// =======================
// ACTUALIZAR INTERFAZ
// =======================
function update() {
    let totalExpenses = 0;
    let totalIncome = 0;
    let categoryTotals = {};
    let balanceTimeline = [];

    const tableBody = document.querySelector("#expenseTable tbody");
    tableBody.innerHTML = "";

    expenses.forEach((e) => {
        if (e.type === "Gasto") {
            totalExpenses += Number(e.amount);
            categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
        } else {
            totalIncome += Number(e.amount);
        }

        balanceTimeline.push({
            date: e.date,
            balance: totalIncome - totalExpenses
        });

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${e.date}</td>
            <td style="color:${categoryColors[e.category] || "#fff"}; font-weight:bold;">${e.category}</td>
            <td>${e.description}</td>
            <td>S/ ${Number(e.amount).toFixed(2)}</td>
            <td>${e.payment}</td>
            <td>${e.type}</td>
            <td>${e.notes || ""}</td>
            <td>
                <button class="delete-btn" data-id="${e.id}">
                    <i class="fas fa-trash"></i> Borrar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    document.getElementById("balance").textContent = `S/ ${(totalIncome - totalExpenses).toFixed(2)}`;
    document.getElementById("totalExpenses").textContent = `S/ ${totalExpenses.toFixed(2)}`;
    document.getElementById("totalIncome").textContent = `S/ ${totalIncome.toFixed(2)}`;

    const labels = Object.keys(categoryTotals);
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = Object.values(categoryTotals);
    categoryChart.data.datasets[0].backgroundColor = labels.map(label => categoryColors[label] || "#ccc");
    categoryChart.update();

    balanceChart.data.labels = balanceTimeline.map(item => item.date);
    balanceChart.data.datasets[0].data = balanceTimeline.map(item => item.balance);
    balanceChart.update();

    bindDeleteButtons();
}

// =======================
// BOTONES BORRAR
// =======================
function bindDeleteButtons() {
    document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
            await deleteExpense(id);
        });
    });
}

// =======================
// BUSCADOR
// =======================
searchInput.addEventListener("input", function () {
    const val = this.value.toLowerCase();
    document.querySelectorAll("#expenseTable tbody tr").forEach((tr) => {
        tr.style.display = tr.textContent.toLowerCase().includes(val) ? "" : "none";
    });
});

// =======================
// CAMBIAR TAB
// =======================
function activateTab(tabId) {
    document.querySelectorAll("nav li").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    document.querySelector(`nav li[data-tab="${tabId}"]`)?.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
}

// =======================
// ESTADO DE SESIÓN
// =======================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userInfo.textContent = `Bienvenido, ${user.email}`;
        await loadData();
    } else {
        authSection.style.display = "block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        expenses = [];
        update();
        activateTab("dashboard");
    }
});
