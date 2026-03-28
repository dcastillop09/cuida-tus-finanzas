import {
  auth,
  db,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
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

/* =========================
   ESTADO GLOBAL
========================= */
let expenses = [];
let pendingDeleteId = null;
let currentTutorialStep = 1;

/* =========================
   PWA INSTALL
========================= */
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  console.log("beforeinstallprompt detectado");
  e.preventDefault();
  deferredPrompt = e;

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("installBtn");

  if (installBtn) {
    installBtn.addEventListener("click", installApp);
  }
});

const totalTutorialSteps = 6;

let userProfile = {
  name: "",
  expenseLimit: 0
};

const currency = "S/";

const categoryColors = {
  Comida: "#8e44ad",
  Transporte: "#e74c3c",
  Entretenimiento: "#e67e22",
  Remuneración: "#3498db",
  Salud: "#2ecc71",
  Vivienda: "#f1c40f"
};

/* =========================
   DOM
========================= */
const DOM = {
  loadingScreen: document.getElementById("loadingScreen"),
  appMain: document.getElementById("appMain"),
  authSection: document.getElementById("authSection"),
  userInfo: document.getElementById("userInfo"),

  auth: {
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    registerBtn: document.getElementById("registerBtn"),
    loginBtn: document.getElementById("loginBtn"),
    googleLoginBtn: document.getElementById("googleLoginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    editProfileBtn: document.getElementById("editProfileBtn"),
    themeToggleBtn: document.getElementById("themeToggleBtn")
  },

  forms: {
    expenseForm: document.getElementById("expenseForm"),
    limitForm: document.getElementById("limitForm"),
    editMovementForm: document.getElementById("editMovementForm")
  },

  movement: {
    date: document.getElementById("date"),
    category: document.getElementById("category"),
    description: document.getElementById("description"),
    amount: document.getElementById("amount"),
    payment: document.getElementById("payment"),
    type: document.getElementById("type"),
    notes: document.getElementById("notes"),
    submitMovementBtn: document.getElementById("submitMovementBtn"),
    expenseLimitInput: document.getElementById("expenseLimitInput")
  },

  filters: {
    searchInput: document.getElementById("searchInput"),
    filterType: document.getElementById("filterType"),
    filterCategory: document.getElementById("filterCategory"),
    filterStartDate: document.getElementById("filterStartDate"),
    filterEndDate: document.getElementById("filterEndDate"),
    sortOrder: document.getElementById("sortOrder"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
    historyFilters: document.getElementById("historyFilters")
  },

  history: {
    expenseTableBody: document.querySelector("#expenseTable tbody"),
    emptyState: document.getElementById("emptyState"),
    mobileHistoryList: document.getElementById("mobileHistoryList")
  },

  modals: {
    profileModal: document.getElementById("profileModal"),
    editMovementModal: document.getElementById("editMovementModal"),
    deleteModal: document.getElementById("deleteModal"),
    tutorialModal: document.getElementById("tutorialModal")
  },

  profile: {
    profileNameInput: document.getElementById("profileNameInput"),
    profileLimitInput: document.getElementById("profileLimitInput"),
    saveProfileBtn: document.getElementById("saveProfileBtn")
  },

  delete: {
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    cancelDeleteBtn: document.getElementById("cancelDeleteBtn")
  },

  summary: {
    balance: document.getElementById("balance"),
    totalExpenses: document.getElementById("totalExpenses"),
    totalIncome: document.getElementById("totalIncome"),
    highestExpense: document.getElementById("highestExpense"),
    topCategory: document.getElementById("topCategory"),
    lastMovement: document.getElementById("lastMovement")
  },

  limit: {
    expenseLimitLabel: document.getElementById("expenseLimitLabel"),
    limitProgress: document.getElementById("limitProgress"),
    limitProgressText: document.getElementById("limitProgressText")
  },

  comparison: {
    currentMonthExpense: document.getElementById("currentMonthExpense"),
    previousMonthExpense: document.getElementById("previousMonthExpense"),
    monthlyDifference: document.getElementById("monthlyDifference"),
    monthlyTrendBadge: document.getElementById("monthlyTrendBadge"),
    comparisonText: document.getElementById("comparisonText"),
    comparisonCurrentBar: document.getElementById("comparisonCurrentBar")
  },

  edit: {
    id: document.getElementById("editId"),
    date: document.getElementById("editDate"),
    category: document.getElementById("editCategory"),
    description: document.getElementById("editDescription"),
    amount: document.getElementById("editAmount"),
    payment: document.getElementById("editPayment"),
    type: document.getElementById("editType"),
    notes: document.getElementById("editNotes")
  },

  charts: {
    balanceCanvas: document.getElementById("balanceChart"),
    barCanvas: document.getElementById("barChart")
  },

  tutorial: {
    floatingBtn: document.getElementById("tutorialFloatingBtn"),
    stepIndicator: document.getElementById("tutorialStepIndicator"),
    prevBtn: document.getElementById("tutorialPrevBtn"),
    nextBtn: document.getElementById("tutorialNextBtn"),
    finishBtn: document.getElementById("tutorialFinishBtn"),
    steps: document.querySelectorAll(".tutorial-step")
  }
};

DOM.charts.balanceCtx = DOM.charts.balanceCanvas
  ? DOM.charts.balanceCanvas.getContext("2d")
  : null;

DOM.charts.barCtx = DOM.charts.barCanvas
  ? DOM.charts.barCanvas.getContext("2d")
  : null;

/* =========================
   HELPERS
========================= */
function formatMoney(value) {
  return `${currency} ${Number(value).toFixed(2)}`;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setHtml(el, value) {
  if (el) el.innerHTML = value;
}

function setWidth(el, value) {
  if (el) el.style.width = value;
}

function safeResizeUpdateChart(chart) {
  if (!chart) return;
  chart.resize();
  chart.update();
}

function showElement(el) {
  if (el) el.classList.remove("hidden");
}

function hideElement(el) {
  if (el) el.classList.add("hidden");
}

function showToast(title, message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-message">${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(10px)";
    toast.style.transition = "0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function getCurrentUser() {
  return auth.currentUser;
}

function installApp() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === "accepted") {
      console.log("Usuario instaló la app");
    } else {
      console.log("Usuario canceló la instalación");
    }
    deferredPrompt = null;

    const installBtn = document.getElementById("installBtn");
    if (installBtn) {
      installBtn.classList.add("hidden");
    }
  });
}

function getAuthFormValues() {
  return {
    email: DOM.auth.email?.value.trim() || "",
    password: DOM.auth.password?.value.trim() || ""
  };
}

function getMovementFormValues() {
  return {
    date: DOM.movement.date?.value || "",
    category: DOM.movement.category?.value || "",
    description: DOM.movement.description?.value.trim() || "",
    amount: parseFloat(DOM.movement.amount?.value),
    payment: DOM.movement.payment?.value || "",
    type: DOM.movement.type?.value || "",
    notes: DOM.movement.notes?.value.trim() || ""
  };
}

function getEditFormValues() {
  return {
    id: DOM.edit.id?.value || "",
    data: {
      date: DOM.edit.date?.value || "",
      category: DOM.edit.category?.value || "",
      description: DOM.edit.description?.value.trim() || "",
      amount: parseFloat(DOM.edit.amount?.value),
      payment: DOM.edit.payment?.value || "",
      type: DOM.edit.type?.value || "",
      notes: DOM.edit.notes?.value.trim() || ""
    }
  };
}

function resetMovementSubmitButton() {
  if (!DOM.movement.submitMovementBtn) return;
  DOM.movement.submitMovementBtn.disabled = false;
  DOM.movement.submitMovementBtn.textContent = "Agregar movimiento";
}

function setMovementSubmitLoading() {
  if (!DOM.movement.submitMovementBtn) return;
  DOM.movement.submitMovementBtn.disabled = true;
  DOM.movement.submitMovementBtn.textContent = "Guardando...";
}

function sortExpensesChronologically(list) {
  list.sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function openModal(modal) {
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modal) {
  if (modal) modal.classList.add("hidden");
}

function getThemeTextColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--text")
    .trim() || "#fff";
}

/* =========================
   TUTORIAL
========================= */
function getTutorialStorageKey(user) {
  return user ? `tutorial_seen_${user.uid}` : "tutorial_seen_guest";
}

function hasSeenTutorial(user) {
  return localStorage.getItem(getTutorialStorageKey(user)) === "true";
}

function markTutorialAsSeen(user) {
  localStorage.setItem(getTutorialStorageKey(user), "true");
}

function updateTutorialUI() {
  if (!DOM.tutorial.steps.length) return;

  DOM.tutorial.steps.forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentTutorialStep);
  });

  setText(DOM.tutorial.stepIndicator, `Paso ${currentTutorialStep} de ${totalTutorialSteps}`);

  if (DOM.tutorial.prevBtn) {
    DOM.tutorial.prevBtn.disabled = currentTutorialStep === 1;
    DOM.tutorial.prevBtn.style.opacity = currentTutorialStep === 1 ? "0.5" : "1";
    DOM.tutorial.prevBtn.style.pointerEvents = currentTutorialStep === 1 ? "none" : "auto";
  }

  if (DOM.tutorial.nextBtn) {
    DOM.tutorial.nextBtn.classList.toggle("hidden", currentTutorialStep === totalTutorialSteps);
  }

  if (DOM.tutorial.finishBtn) {
    DOM.tutorial.finishBtn.classList.toggle("hidden", currentTutorialStep !== totalTutorialSteps);
  }
}

function openTutorial(step = 1) {
  currentTutorialStep = step;
  updateTutorialUI();
  openModal(DOM.modals.tutorialModal);
}

function closeTutorial() {
  const user = getCurrentUser();

  markTutorialAsSeen(user);
  closeModal(DOM.modals.tutorialModal);

  if (expenses.length === 0) {
    setTimeout(() => {
      activateTab("register");
      if (DOM.movement.description) {
        DOM.movement.description.focus();
      }
    }, 300);
  }
}

function nextTutorialStep() {
  if (currentTutorialStep < totalTutorialSteps) {
    currentTutorialStep++;
    updateTutorialUI();
  }
}

function prevTutorialStep() {
  if (currentTutorialStep > 1) {
    currentTutorialStep--;
    updateTutorialUI();
  }
}

function maybeShowTutorialForFirstTime(user) {
  if (!user) return;
  if (hasSeenTutorial(user)) return;

  setTimeout(() => {
    openTutorial(1);
  }, 700);
}

/* =========================
   TEMA
========================= */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  if (DOM.auth.themeToggleBtn) {
    DOM.auth.themeToggleBtn.textContent = theme === "dark" ? "🌙" : "☀️";
  }
}

function refreshChartsAppearance() {
  const color = getThemeTextColor();

  if (balanceChart) {
    balanceChart.options.plugins.legend.labels.color = color;
    balanceChart.options.scales.x.ticks.color = color;
    balanceChart.options.scales.y.ticks.color = color;
  }

  if (barChart) {
    barChart.options.scales.x.ticks.color = color;
    barChart.options.scales.y.ticks.color = color;
  }

  setTimeout(() => {
    safeResizeUpdateChart(balanceChart);
    safeResizeUpdateChart(barChart);
  }, 100);
}

applyTheme(localStorage.getItem("theme") || "dark");

/* =========================
   CHARTS
========================= */
let balanceChart = DOM.charts.balanceCtx
  ? new Chart(DOM.charts.balanceCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Saldo acumulado",
            data: [],
            borderColor: "#1dd1a1",
            backgroundColor: "rgba(29, 209, 161, 0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: getThemeTextColor() }
          }
        },
        scales: {
          x: { ticks: { color: getThemeTextColor() } },
          y: { ticks: { color: getThemeTextColor() } }
        }
      }
    })
  : null;

let barChart = DOM.charts.barCtx
  ? new Chart(DOM.charts.barCtx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Gastos",
            data: [],
            borderRadius: 8,
            backgroundColor: []
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            ticks: { color: getThemeTextColor() }
          },
          y: {
            beginAtZero: true,
            ticks: { color: getThemeTextColor() }
          }
        }
      }
    })
  : null;

/* =========================
   NAVEGACIÓN Y MODALES
========================= */
function setActiveNav(tabId) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
}

function activateTab(tabId) {
  setActiveNav(tabId);

  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.remove("active");
  });

  document.getElementById(tabId)?.classList.add("active");

  setTimeout(() => {
    safeResizeUpdateChart(balanceChart);
    safeResizeUpdateChart(barChart);
  }, 150);
}

/* =========================
   PERFIL
========================= */
async function loadUserProfile(user) {
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    userProfile = {
      name: snap.data().name || user.email?.split("@")[0] || "Usuario",
      expenseLimit: Number(snap.data().expenseLimit || 0)
    };
  } else {
    userProfile = {
      name: user.displayName || user.email?.split("@")[0] || "Usuario",
      expenseLimit: 0
    };
    await setDoc(ref, userProfile);
  }

  setText(DOM.userInfo, `Bienvenido, ${userProfile.name}`);
  updateLimitUI();
}

async function saveProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const name = DOM.profile.profileNameInput?.value.trim() || "";
  const expenseLimit = parseFloat(DOM.profile.profileLimitInput?.value) || 0;

  if (!name) {
    showToast("Nombre requerido", "Ingresa un nombre.", "warning");
    return;
  }

  try {
    userProfile.name = name;
    userProfile.expenseLimit = expenseLimit;

    await setDoc(doc(db, "usuarios", user.uid), userProfile);

    setText(DOM.userInfo, `Bienvenido, ${userProfile.name}`);
    updateLimitUI();
    closeModal(DOM.modals.profileModal);
    showToast("Perfil actualizado", "Tus datos se guardaron correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo actualizar el perfil.", "error");
  }
}

async function saveExpenseLimit(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) return;

  const value = parseFloat(DOM.movement.expenseLimitInput?.value);

  if (isNaN(value) || value < 0) {
    showToast("Tope inválido", "Ingresa un monto válido.", "warning");
    return;
  }

  try {
    userProfile.expenseLimit = value;
    await updateDoc(doc(db, "usuarios", user.uid), { expenseLimit: value });

    if (DOM.movement.expenseLimitInput) {
      DOM.movement.expenseLimitInput.value = "";
    }

    updateLimitUI();
    showToast("Tope guardado", "Tu tope mensual fue actualizado.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo guardar el tope.", "error");
  }
}

/* =========================
   AUTH
========================= */
async function registerUser() {
  const { email, password } = getAuthFormValues();

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
      expenseLimit: 0
    });

    showToast("Cuenta creada", "Tu cuenta fue registrada correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error al registrarte", error.message, "error");
  }
}

async function loginUser() {
  const { email, password } = getAuthFormValues();

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
}

async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const profileRef = doc(db, "usuarios", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        name: user.displayName || user.email?.split("@")[0] || "Usuario",
        expenseLimit: 0
      });
    }

    showToast("Google login", "Sesión iniciada correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error con Google", error.message, "error");
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    showToast("Sesión cerrada", "Vuelve pronto.", "info");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo cerrar sesión.", "error");
  }
}

/* =========================
   MOVIMIENTOS
========================= */
async function loadData() {
  const user = getCurrentUser();
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

    sortExpensesChronologically(expenses);
    update();
  } catch (error) {
    console.error("ERROR LOAD DATA:", error);
    showToast("Error", "No se pudieron cargar los movimientos.", "error");
  }
}

async function createMovement(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    showToast("Sesión requerida", "Debes iniciar sesión.", "warning");
    return;
  }

  const movement = getMovementFormValues();

  if (
    !movement.date ||
    !movement.category ||
    !movement.description ||
    isNaN(movement.amount) ||
    movement.amount <= 0
  ) {
    showToast("Campos inválidos", "Completa correctamente el formulario.", "warning");
    return;
  }

  setMovementSubmitLoading();

  try {
    await addDoc(collection(db, "movimientos"), {
      uid: user.uid,
      ...movement,
      createdAt: Date.now()
    });

    DOM.forms.expenseForm?.reset();
    await loadData();
    activateTab("history");
    showToast("Movimiento agregado", "Tu registro se guardó correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo guardar el movimiento.", "error");
  } finally {
    resetMovementSubmitButton();
  }
}

function openEditMovement(id) {
  const movement = expenses.find((item) => item.id === id);
  if (!movement) return;

  if (DOM.edit.id) DOM.edit.id.value = movement.id;
  if (DOM.edit.date) DOM.edit.date.value = movement.date;
  if (DOM.edit.category) DOM.edit.category.value = movement.category;
  if (DOM.edit.description) DOM.edit.description.value = movement.description;
  if (DOM.edit.amount) DOM.edit.amount.value = movement.amount;
  if (DOM.edit.payment) DOM.edit.payment.value = movement.payment;
  if (DOM.edit.type) DOM.edit.type.value = movement.type;
  if (DOM.edit.notes) DOM.edit.notes.value = movement.notes || "";

  openModal(DOM.modals.editMovementModal);
}

async function updateMovement(event) {
  event.preventDefault();

  const { id, data } = getEditFormValues();

  if (
    !data.date ||
    !data.category ||
    !data.description ||
    isNaN(data.amount) ||
    data.amount <= 0
  ) {
    showToast("Datos inválidos", "Completa correctamente la edición.", "warning");
    return;
  }

  try {
    await updateDoc(doc(db, "movimientos", id), data);

    const index = expenses.findIndex((item) => item.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...data };
    }

    sortExpensesChronologically(expenses);
    closeModal(DOM.modals.editMovementModal);
    update();
    showToast("Movimiento actualizado", "Los cambios se guardaron correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo actualizar el movimiento.", "error");
  }
}

async function confirmDeleteMovement() {
  if (!pendingDeleteId) return;

  try {
    await deleteDoc(doc(db, "movimientos", pendingDeleteId));
    expenses = expenses.filter((item) => item.id !== pendingDeleteId);
    pendingDeleteId = null;
    closeModal(DOM.modals.deleteModal);
    update();
    showToast("Movimiento eliminado", "El registro fue eliminado correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast("Error", "No se pudo eliminar el movimiento.", "error");
  }
}

/* =========================
   FILTROS Y RENDER
========================= */
function getFilteredExpenses() {
  let filtered = [...expenses];

  const searchVal = DOM.filters.searchInput?.value.toLowerCase().trim() || "";
  const typeVal = DOM.filters.filterType?.value || "";
  const categoryVal = DOM.filters.filterCategory?.value || "";
  const startVal = DOM.filters.filterStartDate?.value || "";
  const endVal = DOM.filters.filterEndDate?.value || "";
  const sortVal = DOM.filters.sortOrder?.value || "newest";

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

  if (sortVal === "newest") filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sortVal === "oldest") filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortVal === "highest") filtered.sort((a, b) => Number(b.amount) - Number(a.amount));
  if (sortVal === "lowest") filtered.sort((a, b) => Number(a.amount) - Number(b.amount));

  return filtered;
}

function renderTableHistory(filteredExpenses) {
  if (!DOM.history.expenseTableBody) return;

  DOM.history.expenseTableBody.innerHTML = "";

  filteredExpenses.forEach((e) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${e.date}</td>
      <td style="color:${categoryColors[e.category] || "#fff"}; font-weight:700;">${e.category}</td>
      <td>${e.description}</td>
      <td>${formatMoney(e.amount)}</td>
      <td>${e.payment}</td>
      <td>${e.type}</td>
      <td>${e.notes || ""}</td>
      <td>
        <button class="edit-btn" data-id="${e.id}">Editar</button>
        <button class="delete-btn" data-id="${e.id}">Borrar</button>
      </td>
    `;
    DOM.history.expenseTableBody.appendChild(row);
  });
}

function renderMobileHistory(filteredExpenses) {
  if (!DOM.history.mobileHistoryList) return;

  setHtml(DOM.history.mobileHistoryList, "");

  if (filteredExpenses.length === 0) {
    setHtml(
      DOM.history.mobileHistoryList,
      `
      <div class="mobile-history-card">
        <div class="empty-state">
          <h3>No hay movimientos</h3>
          <p>Empieza registrando tu primer ingreso o gasto.</p>
        </div>
      </div>
    `
    );
    return;
  }

  filteredExpenses.forEach((e) => {
    const card = document.createElement("div");
    card.className = "mobile-history-card";

    card.innerHTML = `
      <div class="mobile-history-top">
        <div>
          <div class="mobile-history-category" style="color:${categoryColors[e.category] || "#fff"};">${e.category}</div>
          <div class="mobile-history-date">${e.date}</div>
        </div>
        <div class="mobile-history-amount">${formatMoney(e.amount)}</div>
      </div>

      <div class="mobile-history-desc">${e.description}</div>

      <div class="mobile-history-meta">
        <span><strong>Tipo:</strong> ${e.type}</span>
        <span><strong>Pago:</strong> ${e.payment}</span>
        <span><strong>Notas:</strong> ${e.notes || "-"}</span>
      </div>

      <div class="mobile-history-actions">
        <button class="mobile-action-btn edit" data-id="${e.id}">Editar</button>
        <button class="mobile-action-btn delete" data-id="${e.id}">Borrar</button>
      </div>
    `;

    DOM.history.mobileHistoryList.appendChild(card);
  });

  document.querySelectorAll(".mobile-action-btn.edit").forEach((btn) => {
    btn.addEventListener("click", () => openEditMovement(btn.dataset.id));
  });

  document.querySelectorAll(".mobile-action-btn.delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteId = btn.dataset.id;
      openModal(DOM.modals.deleteModal);
    });
  });
}

function updateSummary(totalIncome, totalExpenses, categoryTotals) {
  setText(DOM.summary.balance, formatMoney(totalIncome - totalExpenses));
  setText(DOM.summary.totalExpenses, formatMoney(totalExpenses));
  setText(DOM.summary.totalIncome, formatMoney(totalIncome));

  const highestSingleExpense = expenses
    .filter((item) => item.type === "Gasto")
    .reduce((max, item) => Math.max(max, Number(item.amount)), 0);

  setText(DOM.summary.highestExpense, formatMoney(highestSingleExpense));

  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  setText(DOM.summary.topCategory, topCategoryEntry ? topCategoryEntry[0] : "-");

  let last = "-";
  if (expenses.length > 0) {
    const lastItem = expenses[expenses.length - 1];
    last = `${lastItem.description} (${lastItem.date})`;
  }
  setText(DOM.summary.lastMovement, last);
}

function updateCharts(categoryTotals, balanceTimeline) {
  const labels = Object.keys(categoryTotals);
  const values = Object.values(categoryTotals);

  if (balanceChart) {
    balanceChart.data.labels = balanceTimeline.map((item) => item.date);
    balanceChart.data.datasets[0].data = balanceTimeline.map((item) => item.balance);
  }

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data = values;
    barChart.data.datasets[0].backgroundColor = labels.map(
      (label) => categoryColors[label] || "#999"
    );
  }
}

function bindActionButtons() {
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeleteId = btn.dataset.id;
      openModal(DOM.modals.deleteModal);
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditMovement(btn.dataset.id));
  });
}

function update() {
  let totalExpenses = 0;
  let totalIncome = 0;
  const categoryTotals = {};
  const balanceTimeline = [];

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
  });

  const filteredExpenses = getFilteredExpenses();

  renderTableHistory(filteredExpenses);
  renderMobileHistory(filteredExpenses);

  if (DOM.history.emptyState) {
    DOM.history.emptyState.classList.toggle("hidden", filteredExpenses.length !== 0);
  }

  updateSummary(totalIncome, totalExpenses, categoryTotals);
  updateCharts(categoryTotals, balanceTimeline);
  updateLimitUI(totalExpenses);
  updateMonthlyComparison();
  bindActionButtons();

  setTimeout(() => {
    safeResizeUpdateChart(balanceChart);
    safeResizeUpdateChart(barChart);
  }, 100);
}

/* =========================
   LÍMITE Y COMPARACIÓN
========================= */
function updateLimitUI(totalExpensesParam = null) {
  const totalExpenses =
    totalExpensesParam ??
    expenses
      .filter((item) => item.type === "Gasto")
      .reduce((sum, item) => sum + Number(item.amount), 0);

  const limit = Number(userProfile.expenseLimit || 0);

  if (!limit || limit <= 0) {
    setText(DOM.limit.expenseLimitLabel, "No configurado");
    setWidth(DOM.limit.limitProgress, "0%");
    setText(DOM.limit.limitProgressText, "Configura un límite para monitorear tus gastos.");
    DOM.limit.limitProgress?.classList.remove("progress-safe", "progress-warning", "progress-danger");
    return;
  }

  const progress = Math.min((totalExpenses / limit) * 100, 100);

  setText(DOM.limit.expenseLimitLabel, formatMoney(limit));
  setWidth(DOM.limit.limitProgress, `${progress}%`);

  DOM.limit.limitProgress?.classList.remove("progress-safe", "progress-warning", "progress-danger");

  if (progress < 70) {
    DOM.limit.limitProgress?.classList.add("progress-safe");
  } else if (progress < 90) {
    DOM.limit.limitProgress?.classList.add("progress-warning");
  } else {
    DOM.limit.limitProgress?.classList.add("progress-danger");
  }

  setText(
    DOM.limit.limitProgressText,
    `Has gastado ${formatMoney(totalExpenses)} de ${formatMoney(limit)} (${progress.toFixed(1)}%).`
  );
}

function updateMonthlyComparison() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;

  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear--;
  }

  let current = 0;
  let previous = 0;

  expenses.forEach((item) => {
    if (item.type !== "Gasto") return;

    const d = new Date(item.date);
    const m = d.getMonth();
    const y = d.getFullYear();

    if (m === currentMonth && y === currentYear) current += Number(item.amount);
    if (m === prevMonth && y === prevYear) previous += Number(item.amount);
  });

  const diff = current - previous;

  setText(DOM.comparison.currentMonthExpense, formatMoney(current));
  setText(DOM.comparison.previousMonthExpense, formatMoney(previous));
  setText(DOM.comparison.monthlyDifference, formatMoney(Math.abs(diff)));

  let percent = 0;
  if (previous > 0) {
    percent = Math.min((current / previous) * 100, 100);
  } else if (current > 0) {
    percent = 100;
  }

  setWidth(DOM.comparison.comparisonCurrentBar, `${percent}%`);

  if (current > previous) {
    setText(DOM.comparison.monthlyTrendBadge, "Gastaste más");
    if (DOM.comparison.monthlyTrendBadge) {
      DOM.comparison.monthlyTrendBadge.className = "trend-badge up";
    }
    setText(
      DOM.comparison.comparisonText,
      `Este mes llevas ${formatMoney(diff)} más en gastos que el mes anterior.`
    );
  } else if (current < previous) {
    setText(DOM.comparison.monthlyTrendBadge, "Gastaste menos");
    if (DOM.comparison.monthlyTrendBadge) {
      DOM.comparison.monthlyTrendBadge.className = "trend-badge down";
    }
    setText(
      DOM.comparison.comparisonText,
      `Este mes llevas ${formatMoney(previous - current)} menos en gastos que el mes anterior.`
    );
  } else {
    setText(DOM.comparison.monthlyTrendBadge, "Igual");
    if (DOM.comparison.monthlyTrendBadge) {
      DOM.comparison.monthlyTrendBadge.className = "trend-badge neutral";
    }
    setText(
      DOM.comparison.comparisonText,
      "Tus gastos están iguales respecto al mes anterior."
    );
  }
}

/* =========================
   PDF
========================= */
function exportPdf() {
  const filtered = getFilteredExpenses();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.setFontSize(16);
  pdf.text("Reporte financiero - Cuida Tus Finanzas", 14, 18);

  pdf.setFontSize(11);
  pdf.text(`Usuario: ${userProfile.name || "Usuario"}`, 14, 28);
  pdf.text(`Generado: ${new Date().toLocaleString()}`, 14, 35);

  let y = 46;

  filtered.forEach((item, index) => {
    const line = `${index + 1}. ${item.date} | ${item.type} | ${item.category} | ${formatMoney(item.amount)} | ${item.description}`;
    pdf.text(line, 14, y);
    y += 8;

    if (y > 280) {
      pdf.addPage();
      y = 20;
    }
  });

  if (filtered.length === 0) {
    pdf.text("No hay movimientos para exportar.", 14, y);
  }

  pdf.save("reporte-financiero.pdf");
  showToast("PDF exportado", "Tu reporte fue descargado correctamente.", "success");
}

/* =========================
   LISTENERS
========================= */
if (DOM.auth.themeToggleBtn) {
  DOM.auth.themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
    refreshChartsAppearance();
  });
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.dataset.close;
    if (modalId === "tutorialModal") {
      closeTutorial();
      return;
    }
    document.getElementById(modalId)?.classList.add("hidden");
  });
});

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    if (e.target.id === "tutorialModal") {
      closeTutorial();
      return;
    }
    e.target.classList.add("hidden");
  }
});

if (DOM.delete.cancelDeleteBtn) {
  DOM.delete.cancelDeleteBtn.addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal(DOM.modals.deleteModal);
  });
}

if (DOM.filters.toggleFiltersBtn) {
  DOM.filters.toggleFiltersBtn.addEventListener("click", () => {
    DOM.filters.historyFilters?.classList.toggle("show");
  });
}

if (DOM.auth.registerBtn) DOM.auth.registerBtn.addEventListener("click", registerUser);
if (DOM.auth.loginBtn) DOM.auth.loginBtn.addEventListener("click", loginUser);
if (DOM.auth.googleLoginBtn) DOM.auth.googleLoginBtn.addEventListener("click", loginWithGoogle);
if (DOM.auth.logoutBtn) DOM.auth.logoutBtn.addEventListener("click", logoutUser);

if (DOM.auth.editProfileBtn) {
  DOM.auth.editProfileBtn.addEventListener("click", () => {
    if (DOM.profile.profileNameInput) {
      DOM.profile.profileNameInput.value = userProfile.name || "";
    }
    if (DOM.profile.profileLimitInput) {
      DOM.profile.profileLimitInput.value = userProfile.expenseLimit || "";
    }
    openModal(DOM.modals.profileModal);
  });
}

if (DOM.tutorial.floatingBtn) {
  DOM.tutorial.floatingBtn.addEventListener("click", () => openTutorial(1));
}

const installBtn = document.getElementById("installBtn");

if (installBtn) {
  installBtn.addEventListener("click", installApp);
}

if (DOM.tutorial.prevBtn) {
  DOM.tutorial.prevBtn.addEventListener("click", prevTutorialStep);
}

if (DOM.tutorial.nextBtn) {
  DOM.tutorial.nextBtn.addEventListener("click", nextTutorialStep);
}

if (DOM.tutorial.finishBtn) {
  DOM.tutorial.finishBtn.addEventListener("click", closeTutorial);
}

if (DOM.profile.saveProfileBtn) {
  DOM.profile.saveProfileBtn.addEventListener("click", saveProfile);
}

if (DOM.forms.limitForm) {
  DOM.forms.limitForm.addEventListener("submit", saveExpenseLimit);
}

if (DOM.forms.expenseForm) {
  DOM.forms.expenseForm.addEventListener("submit", createMovement);
}

if (DOM.forms.editMovementForm) {
  DOM.forms.editMovementForm.addEventListener("submit", updateMovement);
}

if (DOM.delete.confirmDeleteBtn) {
  DOM.delete.confirmDeleteBtn.addEventListener("click", confirmDeleteMovement);
}

if (DOM.filters.searchInput) DOM.filters.searchInput.addEventListener("input", update);
if (DOM.filters.filterType) DOM.filters.filterType.addEventListener("change", update);
if (DOM.filters.filterCategory) DOM.filters.filterCategory.addEventListener("change", update);
if (DOM.filters.filterStartDate) DOM.filters.filterStartDate.addEventListener("change", update);
if (DOM.filters.filterEndDate) DOM.filters.filterEndDate.addEventListener("change", update);
if (DOM.filters.sortOrder) DOM.filters.sortOrder.addEventListener("change", update);

if (DOM.filters.exportPdfBtn) {
  DOM.filters.exportPdfBtn.addEventListener("click", exportPdf);
}

/* =========================
   AUTH OBSERVER
========================= */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    hideElement(DOM.authSection);

    if (DOM.appMain) {
      DOM.appMain.classList.remove("hidden-app");
      DOM.appMain.classList.add("visible-app");
    }

    DOM.auth.logoutBtn?.classList.remove("hidden");
    DOM.auth.editProfileBtn?.classList.remove("hidden");
    DOM.tutorial.floatingBtn?.classList.remove("hidden");

    await loadUserProfile(user);
    await loadData();
    activateTab("dashboard");
    maybeShowTutorialForFirstTime(user);
  } else {
    showElement(DOM.authSection);

    if (DOM.appMain) {
      DOM.appMain.classList.remove("visible-app");
      DOM.appMain.classList.add("hidden-app");
    }

    DOM.auth.logoutBtn?.classList.add("hidden");
    DOM.auth.editProfileBtn?.classList.add("hidden");
    DOM.tutorial.floatingBtn?.classList.add("hidden");

    closeModal(DOM.modals.tutorialModal);
    setText(DOM.userInfo, "");

    expenses = [];
    userProfile = {
      name: "",
      expenseLimit: 0
    };
  }

  setTimeout(() => {
    hideElement(DOM.loadingScreen);
    refreshChartsAppearance();
  }, 500);
});
