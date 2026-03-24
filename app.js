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
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "./firebase.js";

let expenses = [];
let pendingDeleteId = null;

let userProfile = {
    name: "",
    expenseLimit: 0,
    goalAmount: 0,
    alert90Shown: false,
    alert100Shown: false
};

const categoryColors = {
    "Comida": "#8e44ad",
    "Transporte": "#e74c3c",
    "Entretenimiento": "#e67e22",
    "Remuneración": "#3498db",
    "Salud": "#2ecc71",
    "Vivienda": "#f1c40f"
};

const loadingScreen = document.getElementById("loadingScreen");
const appMain = document.getElementById("appMain");
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const form = document.getElementById("expenseForm");
const limitForm = document.getElementById("limitForm");
const goalForm = document.getElementById("goalForm");

const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterCategory = document.getElementById("filterCategory");
const filterStartDate = document.getElementById("filterStartDate");
const filterEndDate = document.getElementById("filterEndDate");
const sortOrder = document.getElementById("sortOrder");
const exportPdfBtn = document.getElementById("exportPdfBtn");

const expenseTableBody = document.querySelector("#expenseTable tbody");
const emptyState = document.getElementById("emptyState");

const profileModal = document.getElementById("profileModal");
const editMovementModal = document.getElementById("editMovementModal");
const deleteModal = document.getElementById("deleteModal");

const profileNameInput = document.getElementById("profileNameInput");
const profileLimitInput = document.getElementById("profileLimitInput");
const profileGoalInput = document.getElementById("profileGoalInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const editMovementForm = document.getElementById("editMovementForm");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

const expenseLimitLabel = document.getElementById("expenseLimitLabel");
const limitProgress = document.getElementById("limitProgress");
const limitProgressText = document.getElementById("limitProgressText");

const highestExpense = document.getElementById("highestExpense");
const topCategory = document.getElementById("topCategory");
const lastMovement = document.getElementById("lastMovement");

const goalLabel = document.getElementById("goalLabel");
const goalSavedLabel = document.getElementById("goalSavedLabel");
const goalProgress = document.getElementById("goalProgress");
const goalProgressText = document.getElementById("goalProgressText");

const categoryChartCtx = document.getElementById("categoryChart").getContext("2d");
const balanceChartCtx = document.getElementById("balanceChart").getContext("2d");

/* =======================
   TOASTS
======================= */
function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(12px)";
        toast.style.transition = "0.25s ease";
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

/* =======================
   THEME
======================= */
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);

    themeToggleBtn.innerHTML = theme === "dark"
        ? `<i class="fas fa-moon"></i>`
        : `<i class="fas fa-sun"></i>`;
}

themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("theme") || "dark");

/* =======================
   CHARTS
======================= */
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
                labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || "#fff" }
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
            borderColor: "#16d9a6",
            backgroundColor: "rgba(22,217,166,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#16d9a6"
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || "#fff" }
            }
        },
        scales: {
            x: {
                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || "#fff" },
                grid: { color: "rgba(255,255,255,0.08)" }
            },
            y: {
                ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || "#fff" },
                grid: { color: "rgba(255,255,255,0.08)" }
            }
        }
    }
});

/* =======================
   NAV
======================= */
document.querySelectorAll(".top-nav li").forEach(tab => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateTab(tabId) {
    document.querySelectorAll(".top-nav li").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".bottom-nav-btn").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    document.querySelector(`.top-nav li[data-tab="${tabId}"]`)?.classList.add("active");
    document.querySelector(`.bottom-nav-btn[data-tab="${tabId}"]`)?.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
}

/* =======================
   MODALS
======================= */
function openModal(modal) {
    modal.classList.remove("hidden");
}

function closeModal(modal) {
    modal.classList.add("hidden");
}

document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close");
        document.getElementById(modalId)?.classList.add("hidden");
    });
});

window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.add("hidden");
    }
});

cancelDeleteBtn.addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal(deleteModal);
});

/* =======================
   AUTH
======================= */
registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        showToast("Campos incompletos", "Completa correo y contraseña.", "warning");
        return;
    }

    if (password.length < 6) {
        showToast("Contraseña inválida", "Debe tener al menos 6 caracteres.", "warning");
        return;
    }

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "usuarios", cred.user.uid), {
            name: email.split("@")[0],
            expenseLimit: 0,
            goalAmount: 0,
            alert90Shown: false,
            alert100Shown: false
        });

        showToast("Cuenta creada", "Tu cuenta fue registrada correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error al registrarte", error.message, "error");
    }
});

loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        showToast("Campos incompletos", "Completa correo y contraseña.", "warning");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Bienvenido", "Sesión iniciada correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error al iniciar sesión", error.message, "error");
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        showToast("Sesión cerrada", "Vuelve pronto.", "info");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo cerrar sesión.", "error");
    }
});

/* =======================
   PROFILE
======================= */
editProfileBtn.addEventListener("click", () => {
    profileNameInput.value = userProfile.name || "";
    profileLimitInput.value = userProfile.expenseLimit || "";
    profileGoalInput.value = userProfile.goalAmount || "";
    openModal(profileModal);
});

saveProfileBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const name = profileNameInput.value.trim();
    const expenseLimit = parseFloat(profileLimitInput.value) || 0;
    const goalAmount = parseFloat(profileGoalInput.value) || 0;

    if (!name) {
        showToast("Nombre requerido", "Ingresa cómo quieres que te llamen.", "warning");
        return;
    }

    try {
        userProfile.name = name;
        userProfile.expenseLimit = expenseLimit;
        userProfile.goalAmount = goalAmount;
        userProfile.alert90Shown = false;
        userProfile.alert100Shown = false;

        await setDoc(doc(db, "usuarios", user.uid), userProfile);

        closeModal(profileModal);
        userInfo.textContent = `Bienvenido, ${userProfile.name}`;
        updateLimitUI();
        updateGoalUI();
        checkExpenseLimitAlerts();
        showToast("Perfil actualizado", "Tus datos se guardaron correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo actualizar el perfil.", "error");
    }
});

/* =======================
   PROFILE DATA
======================= */
async function loadUserProfile(user) {
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        userProfile = {
            name: snap.data().name || user.email.split("@")[0],
            expenseLimit: Number(snap.data().expenseLimit || 0),
            goalAmount: Number(snap.data().goalAmount || 0),
            alert90Shown: !!snap.data().alert90Shown,
            alert100Shown: !!snap.data().alert100Shown
        };
    } else {
        userProfile = {
            name: user.email.split("@")[0],
            expenseLimit: 0,
            goalAmount: 0,
            alert90Shown: false,
            alert100Shown: false
        };
        await setDoc(ref, userProfile);
    }

    userInfo.textContent = `Bienvenido, ${userProfile.name}`;
    updateLimitUI();
    updateGoalUI();
}

async function persistAlerts() {
    const user = auth.currentUser;
    if (!user) return;

    await updateDoc(doc(db, "usuarios", user.uid), {
        alert90Shown: userProfile.alert90Shown,
        alert100Shown: userProfile.alert100Shown
    });
}

/* =======================
   LIMIT + GOAL FORMS
======================= */
limitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const value = parseFloat(document.getElementById("expenseLimitInput").value);

    if (isNaN(value) || value < 0) {
        showToast("Tope inválido", "Ingresa un monto válido.", "warning");
        return;
    }

    try {
        userProfile.expenseLimit = value;
        userProfile.alert90Shown = false;
        userProfile.alert100Shown = false;

        await updateDoc(doc(db, "usuarios", user.uid), {
            expenseLimit: value,
            alert90Shown: false,
            alert100Shown: false
        });

        document.getElementById("expenseLimitInput").value = "";
        updateLimitUI();
        checkExpenseLimitAlerts();
        showToast("Tope guardado", "Tu tope de gastos fue actualizado.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo guardar el tope.", "error");
    }
});

goalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const value = parseFloat(document.getElementById("goalInput").value);

    if (isNaN(value) || value < 0) {
        showToast("Meta inválida", "Ingresa una meta válida.", "warning");
        return;
    }

    try {
        userProfile.goalAmount = value;

        await updateDoc(doc(db, "usuarios", user.uid), {
            goalAmount: value
        });

        document.getElementById("goalInput").value = "";
        updateGoalUI();
        showToast("Meta guardada", "Tu meta de ahorro fue actualizada.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo guardar la meta.", "error");
    }
});

/* =======================
   CREATE MOVEMENT
======================= */
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        showToast("Sesión requerida", "Debes iniciar sesión.", "warning");
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
        showToast("Campos inválidos", "Completa correctamente el formulario.", "warning");
        return;
    }

    const submitBtn = document.getElementById("submitMovementBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`;

    try {
        await addDoc(collection(db, "movimientos"), {
            uid: user.uid,
            date,
            category,
            description,
            amount,
            payment,
            type,
            notes,
            createdAt: Date.now()
        });

        form.reset();
        await loadData();
        activateTab("history");
        showToast("Movimiento agregado", "Tu registro se guardó correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo guardar el movimiento.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-plus"></i> Agregar movimiento`;
    }
});

/* =======================
   LOAD DATA
======================= */
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
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        update();
        checkExpenseLimitAlerts();
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudieron cargar los movimientos.", "error");
    }
}

/* =======================
   FILTERED EXPENSES
======================= */
function getFilteredExpenses() {
    let filtered = [...expenses];

    const searchVal = searchInput.value.toLowerCase().trim();
    const typeVal = filterType.value;
    const categoryVal = filterCategory.value;
    const startVal = filterStartDate.value;
    const endVal = filterEndDate.value;
    const sortVal = sortOrder.value;

    filtered = filtered.filter((item) => {
        const matchesSearch =
            item.description.toLowerCase().includes(searchVal) ||
            item.category.toLowerCase().includes(searchVal) ||
            (item.notes || "").toLowerCase().includes(searchVal) ||
            item.date.toLowerCase().includes(searchVal);

        const matchesType = !typeVal || item.type === typeVal;
        const matchesCategory = !categoryVal || item.category === categoryVal;
        const matchesStart = !startVal || item.date >= startVal;
        const matchesEnd = !endVal || item.date <= endVal;

        return matchesSearch && matchesType && matchesCategory && matchesStart && matchesEnd;
    });

    if (sortVal === "newest") {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortVal === "oldest") {
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortVal === "highest") {
        filtered.sort((a, b) => Number(b.amount) - Number(a.amount));
    } else if (sortVal === "lowest") {
        filtered.sort((a, b) => Number(a.amount) - Number(b.amount));
    }

    return filtered;
}

/* =======================
   UPDATE UI
======================= */
function update() {
    let totalExpenses = 0;
    let totalIncome = 0;
    let categoryTotals = {};
    let balanceTimeline = [];
    let highest = 0;
    let last = "-";

    expenseTableBody.innerHTML = "";

    expenses.forEach((e) => {
        if (e.type === "Gasto") {
            totalExpenses += Number(e.amount);
            categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
            if (Number(e.amount) > highest) highest = Number(e.amount);
        } else {
            totalIncome += Number(e.amount);
        }

        balanceTimeline.push({
            date: e.date,
            balance: totalIncome - totalExpenses
        });
    });

    const filteredExpenses = getFilteredExpenses();

    filteredExpenses.forEach((e, index) => {
        const row = document.createElement("tr");
        row.classList.add("row-animate");
        row.style.animationDelay = `${index * 0.03}s`;
        row.innerHTML = `
            <td>${e.date}</td>
            <td style="color:${categoryColors[e.category] || "#fff"}; font-weight:700;">${e.category}</td>
            <td>${e.description}</td>
            <td>S/ ${Number(e.amount).toFixed(2)}</td>
            <td>${e.payment}</td>
            <td>${e.type}</td>
            <td>${e.notes || ""}</td>
            <td>
                <div class="action-group">
                    <button class="edit-btn" data-id="${e.id}">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="delete-btn" data-id="${e.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        expenseTableBody.appendChild(row);
    });

    emptyState.style.display = filteredExpenses.length === 0 ? "block" : "none";

    document.getElementById("balance").textContent = `S/ ${(totalIncome - totalExpenses).toFixed(2)}`;
    document.getElementById("totalExpenses").textContent = `S/ ${totalExpenses.toFixed(2)}`;
    document.getElementById("totalIncome").textContent = `S/ ${totalIncome.toFixed(2)}`;

    highestExpense.textContent = `S/ ${highest.toFixed(2)}`;

    const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    topCategory.textContent = topCategoryEntry ? topCategoryEntry[0] : "-";

    if (expenses.length > 0) {
        const lastItem = expenses[expenses.length - 1];
        last = `${lastItem.description} (${lastItem.date})`;
    }
    lastMovement.textContent = last;

    const labels = Object.keys(categoryTotals);
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = Object.values(categoryTotals);
    categoryChart.data.datasets[0].backgroundColor = labels.map(label => categoryColors[label] || "#ccc");
    categoryChart.update();

    balanceChart.data.labels = balanceTimeline.map(item => item.date);
    balanceChart.data.datasets[0].data = balanceTimeline.map(item => item.balance);
    balanceChart.update();

    bindActionButtons();
    updateLimitUI(totalExpenses);
    updateGoalUI(totalIncome - totalExpenses);
}

/* =======================
   ACTIONS
======================= */
function bindActionButtons() {
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            pendingDeleteId = btn.dataset.id;
            openModal(deleteModal);
        });
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            openEditMovement(btn.dataset.id);
        });
    });
}

confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    try {
        await deleteDoc(doc(db, "movimientos", pendingDeleteId));
        expenses = expenses.filter(item => item.id !== pendingDeleteId);
        pendingDeleteId = null;
        closeModal(deleteModal);
        update();
        checkExpenseLimitAlerts();
        showToast("Movimiento eliminado", "El registro fue eliminado correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo eliminar el registro.", "error");
    }
});

/* =======================
   EDIT
======================= */
function openEditMovement(id) {
    const movement = expenses.find(item => item.id === id);
    if (!movement) return;

    document.getElementById("editId").value = movement.id;
    document.getElementById("editDate").value = movement.date;
    document.getElementById("editCategory").value = movement.category;
    document.getElementById("editDescription").value = movement.description;
    document.getElementById("editAmount").value = movement.amount;
    document.getElementById("editPayment").value = movement.payment;
    document.getElementById("editType").value = movement.type;
    document.getElementById("editNotes").value = movement.notes || "";

    openModal(editMovementModal);
}

editMovementForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId").value;

    const updatedData = {
        date: document.getElementById("editDate").value,
        category: document.getElementById("editCategory").value,
        description: document.getElementById("editDescription").value.trim(),
        amount: parseFloat(document.getElementById("editAmount").value),
        payment: document.getElementById("editPayment").value,
        type: document.getElementById("editType").value,
        notes: document.getElementById("editNotes").value.trim()
    };

    if (!updatedData.date || !updatedData.category || !updatedData.description || isNaN(updatedData.amount) || updatedData.amount <= 0) {
        showToast("Datos inválidos", "Completa correctamente la edición.", "warning");
        return;
    }

    try {
        await updateDoc(doc(db, "movimientos", id), updatedData);

        const index = expenses.findIndex(item => item.id === id);
        if (index !== -1) {
            expenses[index] = { ...expenses[index], ...updatedData };
        }

        expenses.sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        closeModal(editMovementModal);
        update();
        checkExpenseLimitAlerts();
        showToast("Movimiento actualizado", "Los cambios se guardaron correctamente.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error", "No se pudo actualizar el movimiento.", "error");
    }
});

/* =======================
   LIMIT + ALERTS
======================= */
function getCurrentTotalExpenses() {
    return expenses
        .filter(item => item.type === "Gasto")
        .reduce((acc, item) => acc + Number(item.amount), 0);
}

function updateLimitUI(totalExpensesParam = null) {
    const totalExpenses = totalExpensesParam ?? getCurrentTotalExpenses();
    const limit = Number(userProfile.expenseLimit || 0);

    if (!limit || limit <= 0) {
        expenseLimitLabel.textContent = "No configurado";
        limitProgress.style.width = "0%";
        limitProgress.style.background = "linear-gradient(90deg, #16d9a6, #50f5cb)";
        limitProgressText.textContent = "Configura tu tope mensual de gasto.";
        return;
    }

    const progress = Math.min((totalExpenses / limit) * 100, 100);

    expenseLimitLabel.textContent = `S/ ${limit.toFixed(2)}`;
    limitProgress.style.width = `${progress}%`;

    if (progress >= 100) {
        limitProgress.style.background = "linear-gradient(90deg, #ff4d4f, #ff7a7a)";
    } else if (progress >= 90) {
        limitProgress.style.background = "linear-gradient(90deg, #ffb020, #ffd166)";
    } else {
        limitProgress.style.background = "linear-gradient(90deg, #16d9a6, #50f5cb)";
    }

    limitProgressText.textContent = `Has gastado S/ ${totalExpenses.toFixed(2)} de S/ ${limit.toFixed(2)} (${progress.toFixed(1)}%).`;
}

async function checkExpenseLimitAlerts() {
    const totalExpenses = getCurrentTotalExpenses();
    const limit = Number(userProfile.expenseLimit || 0);

    if (!limit || limit <= 0) return;

    const ratio = totalExpenses / limit;

    if (ratio >= 0.9 && ratio < 1 && !userProfile.alert90Shown) {
        userProfile.alert90Shown = true;
        await persistAlerts();

        showToast(
            "Estás cerca de tu tope",
            `Ya alcanzaste el 90% de tu límite de gastos. Vas en S/ ${totalExpenses.toFixed(2)} de S/ ${limit.toFixed(2)}.`,
            "warning"
        );
    }

    if (ratio >= 1 && !userProfile.alert100Shown) {
        userProfile.alert100Shown = true;
        await persistAlerts();

        showToast(
            "Tope de gastos superado",
            `Ya superaste tu límite configurado. Llevas S/ ${totalExpenses.toFixed(2)} en gastos.`,
            "error"
        );
    }

    if (ratio < 0.9 && (userProfile.alert90Shown || userProfile.alert100Shown)) {
        userProfile.alert90Shown = false;
        userProfile.alert100Shown = false;
        await persistAlerts();
    }
}

/* =======================
   GOALS
======================= */
function updateGoalUI(savedAmountParam = null) {
    const savedAmount = savedAmountParam ?? (
        expenses.reduce((acc, item) => {
            return item.type === "Ingreso"
                ? acc + Number(item.amount)
                : acc - Number(item.amount);
        }, 0)
    );

    const goal = Number(userProfile.goalAmount || 0);

    goalLabel.textContent = `S/ ${goal.toFixed(2)}`;
    goalSavedLabel.textContent = `S/ ${savedAmount.toFixed(2)}`;

    if (!goal || goal <= 0) {
        goalProgress.style.width = "0%";
        goalProgressText.textContent = "Configura una meta para empezar.";
        return;
    }

    const progress = Math.max(0, Math.min((savedAmount / goal) * 100, 100));
    goalProgress.style.width = `${progress}%`;
    goalProgressText.textContent = `Llevas ${progress.toFixed(1)}% de tu meta de ahorro.`;
}

/* =======================
   FILTERS + PDF
======================= */
searchInput.addEventListener("input", update);
filterType.addEventListener("change", update);
filterCategory.addEventListener("change", update);
filterStartDate.addEventListener("change", update);
filterEndDate.addEventListener("change", update);
sortOrder.addEventListener("change", update);

exportPdfBtn.addEventListener("click", () => {
    const filtered = getFilteredExpenses();
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();

    docPdf.setFontSize(16);
    docPdf.text("Reporte de movimientos - Cuida Tus Finanzas", 14, 18);

    docPdf.setFontSize(11);
    docPdf.text(`Usuario: ${userProfile.name || "Usuario"}`, 14, 28);
    docPdf.text(`Generado: ${new Date().toLocaleString()}`, 14, 35);

    let y = 46;
    filtered.forEach((item, index) => {
        const line = `${index + 1}. ${item.date} | ${item.type} | ${item.category} | S/ ${Number(item.amount).toFixed(2)} | ${item.description}`;
        docPdf.text(line, 14, y);
        y += 8;

        if (y > 280) {
            docPdf.addPage();
            y = 20;
        }
    });

    if (filtered.length === 0) {
        docPdf.text("No hay movimientos para exportar.", 14, y);
    }

    docPdf.save("reporte-financiero.pdf");
    showToast("PDF exportado", "Tu reporte se descargó correctamente.", "success");
});

/* =======================
   SESSION STATE
======================= */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        authSection.style.display = "none";
        appMain.classList.remove("app-hidden");
        appMain.classList.add("app-visible");

        logoutBtn.style.display = "inline-block";
        editProfileBtn.style.display = "inline-block";

        await loadUserProfile(user);
        await loadData();
        activateTab("dashboard");
    } else {
        authSection.style.display = "block";
        appMain.classList.remove("app-visible");
        appMain.classList.add("app-hidden");

        logoutBtn.style.display = "none";
        editProfileBtn.style.display = "none";
        userInfo.textContent = "";

        expenses = [];
        userProfile = {
            name: "",
            expenseLimit: 0,
            goalAmount: 0,
            alert90Shown: false,
            alert100Shown: false
        };

        update();
    }

    setTimeout(() => loadingScreen.classList.add("hide"), 500);
});
