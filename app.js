const SESSION_KEY = "nyfrom_session";
const PROFILE_KEY = "nyfrom_profile";

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const profileForm = document.querySelector("#profileForm");
const logoutButton = document.querySelector("#logoutButton");
const clearProfileButton = document.querySelector("#clearProfileButton");
const sessionName = document.querySelector("#sessionName");
const statusMessage = document.querySelector("#statusMessage");

const summaryName = document.querySelector("#summaryName");
const summaryPhone = document.querySelector("#summaryPhone");
const summaryEmail = document.querySelector("#summaryEmail");
const summaryRole = document.querySelector("#summaryRole");

function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showDashboard() {
  loginView.classList.add("is-hidden");
  dashboardView.classList.remove("is-hidden");
}

function showLogin() {
  dashboardView.classList.add("is-hidden");
  loginView.classList.remove("is-hidden");
}

function getProfileFromForm() {
  const data = new FormData(profileForm);

  return {
    name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    role: String(data.get("role") || "Administrador"),
    notes: String(data.get("notes") || "").trim(),
  };
}

function fillProfileForm(profile) {
  profileForm.name.value = profile?.name || "";
  profileForm.phone.value = profile?.phone || "";
  profileForm.email.value = profile?.email || "";
  profileForm.role.value = profile?.role || "Administrador";
  profileForm.notes.value = profile?.notes || "";
}

function renderProfile(profile) {
  summaryName.textContent = profile?.name || "Pendiente";
  summaryPhone.textContent = profile?.phone || "Pendiente";
  summaryEmail.textContent = profile?.email || "Pendiente";
  summaryRole.textContent = profile?.role || "Administrador";
}

function setStatus(message, isSaved = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("saved", isSaved);
}

function loadApp() {
  const session = readStorage(SESSION_KEY);
  const profile = readStorage(PROFILE_KEY, {});

  fillProfileForm(profile);
  renderProfile(profile);

  if (session?.user) {
    sessionName.textContent = session.user;
    showDashboard();
    setStatus("Sesión cargada. Puedes editar o guardar los datos básicos.", true);
    return;
  }

  showLogin();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(loginForm);
  const user = String(data.get("loginUser") || "").trim();

  writeStorage(SESSION_KEY, {
    user,
    loggedAt: new Date().toISOString(),
  });

  sessionName.textContent = user;
  loginForm.reset();
  showDashboard();
  setStatus("Entraste a la app. Esta sesión está guardada solo en este navegador.", true);
});

profileForm.addEventListener("input", () => {
  renderProfile(getProfileFromForm());
  setStatus("Hay cambios sin guardar.");
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const profile = getProfileFromForm();
  writeStorage(PROFILE_KEY, profile);
  renderProfile(profile);
  setStatus("Datos básicos guardados en este navegador.", true);
});

clearProfileButton.addEventListener("click", () => {
  localStorage.removeItem(PROFILE_KEY);
  fillProfileForm({});
  renderProfile({});
  setStatus("Datos básicos limpiados.");
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
  setStatus("Aún no has guardado datos en esta sesión.");
});

loadApp();
