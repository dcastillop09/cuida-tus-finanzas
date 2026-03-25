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

let expenses = [];
let pendingDeleteId = null;

let userProfile = {
  name: "",
  expenseLimit: 0
};

const categoryColors = {
  "Comida": "#8e44ad",
  "Transporte": "#e74c3c",
  "Entretenimiento": "#e67e22",
  "Remuneración": "#3498db",
  "Salud": "#2ecc71",
  "Vivienda": "#f1c40f"
};

const currency = "S/";

const loadingScreen = document.getElementById("loadingScreen");
const appMain = document.getElementById("appMain");
const authSection = document.getElementById("authSection");
const userInfo = document.getElementById("userInfo");

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const form = document.getElementById("expenseForm");
const limitForm = document.getElementById("limitForm");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterCategory = document.getElementById("filterCategory");
const filterStartDate = document.getElementById("filterStartDate");
const filterEndDate = document.getElementById("filterEndDate");
const sortOrder = document.getElementById("sortOrder");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const toggleFiltersBtn = document.getElementById("toggleFiltersBtn");
const historyFilters = document.getElementById("historyFilters");

const expenseTableBody = document.querySelector("#expenseTable tbody");
const emptyState = document.getElementById("emptyState");
const mobileHistoryList = document.getElementById("mobileHistoryList");

const profileModal = document.getElementById("profileModal");
const editMovementModal = document.getElementById("editMovementModal");
const deleteModal = document.getElementById("deleteModal");

const profileNameInput = document.getElementById("profileNameInput");
const profileLimitInput = document.getElementById("profileLimitInput");
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

const currentMonthExpense = document.getElementById("currentMonthExpense");
const previousMonthExpense = document.getElementById("previousMonthExpense");
const monthlyDifference = document.getElementById("monthlyDifference");
const monthlyTrendBadge = document.getElementById("monthlyTrendBadge");
const comparisonText = document.getElementById("comparisonText");
const comparisonCurrentBar = document.getElementById("comparisonCurrentBar");

const categoryChartCanvas = document.getElementById("categoryChart");
const balanceChartCanvas = document.getElementById("balanceChart");

const categoryChartCtx = categoryChartCanvas ? categoryChartCanvas.getContext("2d") : null;
const balanceChartCtx = balanceChartCanvas ? balanceChartCanvas.getContext("2d") : null;

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

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === "dark" ? "🌙" : "☀️";
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
    refreshChartsAppearance();
  });
}

applyTheme(localStorage.getItem("theme") || "dark");

function getThemeTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#fff";
}

let categoryChart = categoryChartCtx ? new Chart(categoryChartCtx, {
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
        labels: { color: getThemeTextColor() }
      }
    }
  }
}) : null;

let balanceChart = balanceChartCtx ? new Chart(balanceChartCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Saldo acumulado",
      data: [],
      borderColor: "#1dd1a1",
      backgroundColor: "rgba(29, 209, 161, 0.12)",
      fill: true,
      tension: 0.35,
      pointRadius: 4
    }]
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
}) : null;

function refreshChartsAppearance() {
  const color = getThemeTextColor();

  if (categoryChart) {
    categoryChart.options.plugins.legend.labels.color = color;
  }

  if (balanceChart) {
    balanceChart.options.plugins.legend.labels.color = color;
    balanceChart.options.scales.x.ticks.color = color;
    balanceChart.options.scales.y.ticks.color = color;
  }

  setTimeout(() => {
    safeResizeUpdateChart(categoryChart);
    safeResizeUpdateChart(balanceChart);
  }, 100);
}

function setActiveNav(tabId) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

document.querySelectorAll(".bottom-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

function activateTab(tabId) {
  setActiveNav(tabId);

  document.querySelectorAll(".tab-content").forEach(section => section.classList.remove("active"));
  document.getElementById(tabId)?.classList.add("active");

  setTimeout(() => {
    safeResizeUpdateChart(categoryChart);
    safeResizeUpdateChart(balanceChart);
  }, 150);
}

function openModal(modal) {
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modal) {
  if (modal) modal.classList.add("hidden");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close)?.classList.add("hidden");
  });
});

window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.add("hidden");
  }
});

if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal(deleteModal);
  });
}

if (toggleFiltersBtn) {
  toggleFiltersBtn.addEventListener("click", () => {
    if (historyFilters) {
      historyFilters.classList.toggle("show");
    }
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";

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
  });
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value.trim() || "";

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
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
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
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Sesión cerrada", "Vuelve pronto.", "info");
    } catch (error) {
      console.error(error);
      showToast("Error", "No se pudo cerrar sesión.", "error");
    }
  });
}

if (editProfileBtn) {
  editProfileBtn.addEventListener("click", () => {
    if (profileNameInput) profileNameInput.value = userProfile.name || "";
    if (profileLimitInput) profileLimitInput.value = userProfile.expenseLimit || "";
    openModal(profileModal);
  });
}

if (saveProfileBtn) {
  saveProfileBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    const name = profileNameInput?.value.trim() || "";
    const expenseLimit = parseFloat(profileLimitInput?.value) || 0;

    if (!name) {
      showToast("Nombre requerido", "Ingresa un nombre.", "warning");
      return;
    }

    try {
      userProfile.name = name;
      userProfile.expenseLimit = expenseLimit;

      await setDoc(doc(db, "usuarios", user.uid), userProfile);

      setText(userInfo, `Bienvenido, ${userProfile.name}`);
      updateLimitUI();
      closeModal(profileModal);
      showToast("Perfil actualizado", "Tus datos se guardaron correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast("Error", "No se pudo actualizar el perfil.", "error");
    }
  });
}

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

  setText(userInfo, `Bienvenido, ${userProfile.name}`);
  updateLimitUI();
}

if (limitForm) {
  limitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const expenseLimitInput = document.getElementById("expenseLimitInput");
    const value = parseFloat(expenseLimitInput?.value);

    if (isNaN(value) || value < 0) {
      showToast("Tope inválido", "Ingresa un monto válido.", "warning");
      return;
    }

    try {
      userProfile.expenseLimit = value;
      await updateDoc(doc(db, "usuarios", user.uid), { expenseLimit: value });
      if (expenseLimitInput) expenseLimitInput.value = "";
      updateLimitUI();
      showToast("Tope guardado", "Tu tope mensual fue actualizado.", "success");
    } catch (error) {
      console.error(error);
      showToast("Error", "No se pudo guardar el tope.", "error");
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      showToast("Sesión requerida", "Debes iniciar sesión.", "warning");
      return;
    }

    const date = document.getElementById("date")?.value || "";
    const category = document.getElementById("category")?.value || "";
    const description = document.getElementById("description")?.value.trim() || "";
    const amount = parseFloat(document.getElementById("amount")?.value);
    const payment = document.getElementById("payment")?.value || "";
    const type = document.getElementById("type")?.value || "";
    const notes = document.getElementById("notes")?.value.trim() || "";

    if (!date || !category || !description || isNaN(amount) || amount <= 0) {
      showToast("Campos inválidos", "Completa correctamente el formulario.", "warning");
      return;
    }

    const submitBtn = document.getElementById("submitMovementBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando...";
    }

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
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Agregar movimiento";
      }
    }
  });
}

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
  } catch (error) {
    console.error("ERROR LOAD DATA:", error);
    showToast("Error", "No se pudieron cargar los movimientos.", "error");
  }
}

function getFilteredExpenses() {
  let filtered = [...expenses];

  const searchVal = searchInput?.value.toLowerCase().trim() || "";
  const typeVal = filterType?.value || "";
  const categoryVal = filterCategory?.value || "";
  const startVal = filterStartDate?.value || "";
  const endVal = filterEndDate?.value || "";
  const sortVal = sortOrder?.value || "newest";

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

function renderMobileHistory(filteredExpenses) {
  if (!mobileHistoryList) return;

  setHtml(mobileHistoryList, "");

  if (filteredExpenses.length === 0) {
    setHtml(mobileHistoryList, `
      <div class="mobile-history-card">
        <div class="empty-state">
          <h3>No hay movimientos</h3>
          <p>Empieza registrando tu primer ingreso o gasto.</p>
        </div>
      </div>
    `);
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

    mobileHistoryList.appendChild(card);
  });

  document.querySelectorAll(".mobile-action-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => {
      openEditMovement(btn.dataset.id);
    });
  });

  document.querySelectorAll(".mobile-action-btn.delete").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingDeleteId = btn.dataset.id;
      openModal(deleteModal);
    });
  });
}

function update() {
  let totalExpenses = 0;
  let totalIncome = 0;
  let categoryTotals = {};
  let balanceTimeline = [];
  let highest = 0;
  let last = "-";

  if (expenseTableBody) {
    expenseTableBody.innerHTML = "";
  }

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

  filteredExpenses.forEach((e) => {
    if (!expenseTableBody) return;

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
    expenseTableBody.appendChild(row);
  });

  renderMobileHistory(filteredExpenses);

  if (emptyState) {
    emptyState.classList.toggle("hidden", filteredExpenses.length !== 0);
  }

  setText(document.getElementById("balance"), formatMoney(totalIncome - totalExpenses));
  setText(document.getElementById("totalExpenses"), formatMoney(totalExpenses));
  setText(document.getElementById("totalIncome"), formatMoney(totalIncome));

  setText(highestExpense, formatMoney(highest));

  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  setText(topCategory, topCategoryEntry ? topCategoryEntry[0] : "-");

  if (expenses.length > 0) {
    const lastItem = expenses[expenses.length - 1];
    last = `${lastItem.description} (${lastItem.date})`;
  }
  setText(lastMovement, last);

  const labels = Object.keys(categoryTotals);

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = Object.values(categoryTotals);
    categoryChart.data.datasets[0].backgroundColor = labels.map(label => categoryColors[label] || "#ccc");
  }

  if (balanceChart) {
    balanceChart.data.labels = balanceTimeline.map(item => item.date);
    balanceChart.data.datasets[0].data = balanceTimeline.map(item => item.balance);
  }

  updateLimitUI(totalExpenses);
  updateMonthlyComparison();
  bindActionButtons();

  setTimeout(() => {
    safeResizeUpdateChart(categoryChart);
    safeResizeUpdateChart(balanceChart);
  }, 100);
}

function updateLimitUI(totalExpensesParam = null) {
  const totalExpenses = totalExpensesParam ?? expenses
    .filter(item => item.type === "Gasto")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const limit = Number(userProfile.expenseLimit || 0);

  if (!limit || limit <= 0) {
    setText(expenseLimitLabel, "No configurado");
    setWidth(limitProgress, "0%");
    setText(limitProgressText, "Configura un límite para monitorear tus gastos.");
    return;
  }

  const progress = Math.min((totalExpenses / limit) * 100, 100);
  setText(expenseLimitLabel, formatMoney(limit));
  setWidth(limitProgress, `${progress}%`);
  setText(limitProgressText, `Has gastado ${formatMoney(totalExpenses)} de ${formatMoney(limit)} (${progress.toFixed(1)}%).`);
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

  setText(currentMonthExpense, formatMoney(current));
  setText(previousMonthExpense, formatMoney(previous));
  setText(monthlyDifference, formatMoney(Math.abs(diff)));

  let percent = 0;
  if (previous > 0) {
    percent = Math.min((current / previous) * 100, 100);
  } else if (current > 0) {
    percent = 100;
  }

  setWidth(comparisonCurrentBar, `${percent}%`);

  if (current > previous) {
    setText(monthlyTrendBadge, "Gastaste más");
    if (monthlyTrendBadge) monthlyTrendBadge.className = "trend-badge up";
    setText(comparisonText, `Este mes llevas ${formatMoney(diff)} más en gastos que el mes anterior.`);
  } else if (current < previous) {
    setText(monthlyTrendBadge, "Gastaste menos");
    if (monthlyTrendBadge) monthlyTrendBadge.className = "trend-badge down";
    setText(comparisonText, `Este mes llevas ${formatMoney(previous - current)} menos en gastos que el mes anterior.`);
  } else {
    setText(monthlyTrendBadge, "Igual");
    if (monthlyTrendBadge) monthlyTrendBadge.className = "trend-badge neutral";
    setText(comparisonText, "Tus gastos están iguales respecto al mes anterior.");
  }
}

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

if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    try {
      await deleteDoc(doc(db, "movimientos", pendingDeleteId));
      expenses = expenses.filter(item => item.id !== pendingDeleteId);
      pendingDeleteId = null;
      closeModal(deleteModal);
      update();
      showToast("Movimiento eliminado", "El registro fue eliminado correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast("Error", "No se pudo eliminar el movimiento.", "error");
    }
  });
}

function openEditMovement(id) {
  const movement = expenses.find(item => item.id === id);
  if (!movement) return;

  const editId = document.getElementById("editId");
  const editDate = document.getElementById("editDate");
  const editCategory = document.getElementById("editCategory");
  const editDescription = document.getElementById("editDescription");
  const editAmount = document.getElementById("editAmount");
  const editPayment = document.getElementById("editPayment");
  const editType = document.getElementById("editType");
  const editNotes = document.getElementById("editNotes");

  if (editId) editId.value = movement.id;
  if (editDate) editDate.value = movement.date;
  if (editCategory) editCategory.value = movement.category;
  if (editDescription) editDescription.value = movement.description;
  if (editAmount) editAmount.value = movement.amount;
  if (editPayment) editPayment.value = movement.payment;
  if (editType) editType.value = movement.type;
  if (editNotes) editNotes.value = movement.notes || "";

  openModal(editMovementModal);
}

if (editMovementForm) {
  editMovementForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId")?.value || "";

    const updatedData = {
      date: document.getElementById("editDate")?.value || "",
      category: document.getElementById("editCategory")?.value || "",
      description: document.getElementById("editDescription")?.value.trim() || "",
      amount: parseFloat(document.getElementById("editAmount")?.value),
      payment: document.getElementById("editPayment")?.value || "",
      type: document.getElementById("editType")?.value || "",
      notes: document.getElementById("editNotes")?.value.trim() || ""
    };

    if (!updatedData.date || !updatedData.category || !updatedData.description || isNaN(updatedData.amount) || updatedData.amount <= 0) {
      showToast("Datos inválidos", "Completa correctamente la edición.", "warning");
      return;
    }

    try {
      await updateDoc(doc(db, "movimientos", id), updatedData);

      const index = expenses.findIndex(item => item.id === id);
      if (index !== -1) expenses[index] = { ...expenses[index], ...updatedData };

      expenses.sort((a, b) => {
        const dateDiff = new Date(a.date) - new Date(b.date);
        if (dateDiff !== 0) return dateDiff;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

      closeModal(editMovementModal);
      update();
      showToast("Movimiento actualizado", "Los cambios se guardaron correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast("Error", "No se pudo actualizar el movimiento.", "error");
    }
  });
}

if (searchInput) searchInput.addEventListener("input", update);
if (filterType) filterType.addEventListener("change", update);
if (filterCategory) filterCategory.addEventListener("change", update);
if (filterStartDate) filterStartDate.addEventListener("change", update);
if (filterEndDate) filterEndDate.addEventListener("change", update);
if (sortOrder) sortOrder.addEventListener("change", update);

if (exportPdfBtn) {
  exportPdfBtn.addEventListener("click", () => {
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
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (authSection) authSection.classList.add("hidden");
    if (appMain) {
      appMain.classList.remove("hidden-app");
      appMain.classList.add("visible-app");
    }

    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (editProfileBtn) editProfileBtn.classList.remove("hidden");

    await loadUserProfile(user);
    await loadData();
    activateTab("dashboard");
  } else {
    if (authSection) authSection.classList.remove("hidden");
    if (appMain) {
      appMain.classList.remove("visible-app");
      appMain.classList.add("hidden-app");
    }

    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (editProfileBtn) editProfileBtn.classList.add("hidden");
    setText(userInfo, "");

    expenses = [];
    userProfile = {
      name: "",
      expenseLimit: 0
    };
  }

  setTimeout(() => {
    if (loadingScreen) loadingScreen.classList.add("hidden");
    refreshChartsAppearance();
  }, 500);
});
