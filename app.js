import {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    collection,
    addDoc,
    getDocs
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

// =======================
// NAVEGACIÓN DE PESTAÑAS
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
// LOGIN / REGISTRO
// =======================
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

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
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Usuario registrado:", userCredential.user);
        alert("Cuenta creada correctamente");
    } catch (error) {
        console.error("Error al registrarse:", error);
        alert("Error: " + error.code + " | " + error.message);
    }
});

loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Completa correo y contraseña");
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Sesión iniciada:", userCredential.user);
        alert("Bienvenido");
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        alert("Error: " + error.code + " | " + error.message);
    }
});

// =======================
// GRÁFICOS
// =======================
const categoryChartCtx = document.getElementById("categoryChart").getContext("2d");
const balanceChartCtx = document.getElementById("balanceChart").getContext("2d");

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
        plugins: {
            legend: {
                position: "bottom",
                labels: { color: "#fff" }
            }
        }
    }
});

let balanceChart = new Chart(balanceChartCtx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Saldo",
            data: [],
            borderColor: "#00e5a8",
            backgroundColor: "rgba(0,229,168,0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 4
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: { ticks: { color: "#fff" } },
            y: { ticks: { color: "#fff" } }
        },
        plugins: {
            legend: {
                labels: { color: "#fff" }
            }
        }
    }
});

// =======================
// FORMULARIO
// =======================
const form = document.getElementById("expenseForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        alert("Debes iniciar sesión");
        return;
    }

    const data = {
        uid: user.uid,
        date: document.getElementById("date").value,
        category: document.getElementById("category").value,
        description: document.getElementById("description").value,
        amount: parseFloat(document.getElementById("amount").value),
        payment: document.getElementById("payment").value,
        type: document.getElementById("type").value,
        notes: document.getElementById("notes").value
    };

    try {
        await addDoc(collection(db, "movimientos"), data);
        alert("Movimiento guardado");
        form.reset();
        await loadData();
    } catch (error) {
        console.error("Error al guardar movimiento:", error);
        alert("Error: " + error.code + " | " + error.message);
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

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.uid === user.uid) {
                expenses.push(data);
            }
        });

        update();
    } catch (error) {
        console.error("Error al cargar datos:", error);
        alert("Error al cargar datos: " + error.message);
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

    expenses.sort((a, b) => new Date(a.date) - new Date(b.date));

    expenses.forEach(e => {
        if (e.type === "Gasto") totalExpenses += Number(e.amount);
        else totalIncome += Number(e.amount);

        if (e.type === "Gasto") {
            categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
        }

        balanceTimeline.push({
            date: e.date,
            balance: totalIncome - totalExpenses
        });

        tableBody.innerHTML += `
            <tr>
                <td>${e.date}</td>
                <td style="color:${categoryColors[e.category] || "#fff"}; font-weight:bold;">${e.category}</td>
                <td>${e.description}</td>
                <td>S/ ${Number(e.amount).toFixed(2)}</td>
                <td>${e.payment}</td>
                <td>${e.type}</td>
                <td>${e.notes || ""}</td>
            </tr>
        `;
    });

    document.getElementById("balance").textContent = `S/ ${(totalIncome - totalExpenses).toFixed(2)}`;
    document.getElementById("totalExpenses").textContent = `S/ ${totalExpenses.toFixed(2)}`;
    document.getElementById("totalIncome").textContent = `S/ ${totalIncome.toFixed(2)}`;

    categoryChart.data.labels = Object.keys(categoryTotals);
    categoryChart.data.datasets[0].data = Object.values(categoryTotals);
    categoryChart.data.datasets[0].backgroundColor = Object.keys(categoryTotals).map(c => categoryColors[c] || "#ccc");
    categoryChart.update();

    balanceChart.data.labels = balanceTimeline.map(item => item.date);
    balanceChart.data.datasets[0].data = balanceTimeline.map(item => item.balance);
    balanceChart.update();
}

// =======================
// BUSCADOR
// =======================
document.getElementById("searchInput").addEventListener("input", function () {
    const val = this.value.toLowerCase();
    document.querySelectorAll("#expenseTable tbody tr").forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(val) ? "" : "none";
    });
});

// =======================
// ESTADO DE SESIÓN
// =======================
onAuthStateChanged(auth, async (user) => {
    const authSection = document.getElementById("authSection");

    if (user) {
        authSection.style.display = "none";
        await loadData();
    } else {
        authSection.style.display = "block";
        expenses = [];
        update();
    }
});











