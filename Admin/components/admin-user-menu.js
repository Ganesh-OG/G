import { DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let currentAdminUser = null;

document.addEventListener("DOMContentLoaded", () => {
  currentAdminUser = getStoredAdminUser();

  if (!currentAdminUser) {
    window.location.replace("./index.html");
    return;
  }

  ensureUserMenu();
  renderUserSummary();
});

function getStoredAdminUser() {
  try {
    const stored = localStorage.getItem("adminUser") || localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("[ADMIN USER] Failed to parse session:", error);
    return null;
  }
}

function setStoredAdminUser(user) {
  currentAdminUser = user;
  localStorage.setItem("adminUser", JSON.stringify(user));
  localStorage.setItem("user", JSON.stringify(user));
}

function clearStoredAdminUser() {
  localStorage.removeItem("adminUser");
  localStorage.removeItem("user");
}

function ensureUserMenu() {
  if (document.getElementById("admin-user-menu")) return;

  const navbar = document.querySelector(".navbar");
  const userHost = document.querySelector(".sidebar-info") || navbar;
  const menuHost = document.querySelector(".sidebar") || navbar;
  if (!navbar || !userHost || !menuHost) return;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = "admin-user-trigger";
  trigger.className = "admin-user-trigger";
  trigger.setAttribute("aria-label", "Open user menu");
  trigger.innerHTML = `<ion-icon name="person-circle-outline"></ion-icon>`;
  trigger.addEventListener("click", () => {
    document.getElementById("admin-user-menu")?.classList.toggle("active");
  });

  userHost.appendChild(trigger);

  const menu = document.createElement("div");
  menu.id = "admin-user-menu";
  menu.className = "admin-user-menu";
  menu.innerHTML = `
    <div class="admin-user-menu-head">
      <strong id="admin-user-name">Admin User</strong>
      <span id="admin-user-email">admin@example.com</span>
    </div>
    <div class="admin-user-menu-actions">
      <button type="button" class="admin-social-manager-btn" data-user-action="edit">Edit User</button>
      <button type="button" class="admin-social-manager-btn" data-user-action="add">Add New User</button>
      <button type="button" class="admin-social-manager-btn" data-user-action="view">User View</button>
      <button type="button" class="admin-social-manager-btn danger" data-user-action="logout">Logout</button>
    </div>
  `;

  menuHost.appendChild(menu);

  menu.querySelector('[data-user-action="edit"]')?.addEventListener("click", openEditUserEditor);
  menu.querySelector('[data-user-action="add"]')?.addEventListener("click", openAddUserEditor);
  menu.querySelector('[data-user-action="view"]')?.addEventListener("click", goToUserView);
  menu.querySelector('[data-user-action="logout"]')?.addEventListener("click", logoutToAdminLogin);

  document.addEventListener("click", (event) => {
    if (!menu.classList.contains("active")) return;
    if (event.target.closest("#admin-user-menu") || event.target.closest("#admin-user-trigger")) return;
    menu.classList.remove("active");
  });
}

function renderUserSummary() {
  const name = document.getElementById("admin-user-name");
  const email = document.getElementById("admin-user-email");
  if (!name || !email || !currentAdminUser) return;

  name.textContent = currentAdminUser.Username || "Admin User";
  email.textContent = currentAdminUser.Email || "No email";
}

function closeUserMenu() {
  document.getElementById("admin-user-menu")?.classList.remove("active");
}

function enhancePasswordEditorField(form) {
  if (!form) return;

  const input = form.querySelector('input[name="Password"]');
  if (!input || input.dataset.passwordToggleReady === "true") return;
  input.dataset.passwordToggleReady = "true";
  input.type = "password";

  const wrapper = document.createElement("div");
  wrapper.className = "admin-password-field";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-password-toggle";
  button.setAttribute("aria-label", "Show password");
  button.innerHTML = `<ion-icon name="eye-outline"></ion-icon>`;
  wrapper.appendChild(button);

  const icon = button.querySelector("ion-icon");
  button.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    icon?.setAttribute("name", visible ? "eye-outline" : "eye-off-outline");
    button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
  });
}

function openEditUserEditor() {
  if (!currentAdminUser) return;
  closeUserMenu();

  openEditor({
    table: "Login",
    row: currentAdminUser,
    title: "Edit User",
    fields: [
      { name: "Username", label: "Username", value: currentAdminUser.Username || "" },
      { name: "Email", label: "Email", value: currentAdminUser.Email || "", type: "email" },
      { name: "Password", label: "Password", value: currentAdminUser.Password || "", type: "password" }
    ],
    onOpen: ({ form }) => enhancePasswordEditorField(form),
    transformPayload: ({ payload }) => ({
      Username: payload.Username?.trim(),
      Email: payload.Email?.trim(),
      Password: payload.Password?.trim()
    }),
    submitHandler: async ({ payload, rowId }) => {
      const response = await fetch(`${DB_BASE}/Login?id=eq.${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const rows = await response.json();
        if (rows[0]) {
          setStoredAdminUser(rows[0]);
          renderUserSummary();
        }
      }

      return response;
    }
  });
}

function openAddUserEditor() {
  closeUserMenu();

  openEditor({
    table: "Login",
    title: "Add New User",
    method: "POST",
    fields: [
      { name: "Username", label: "Username", value: "" },
      { name: "Email", label: "Email", value: "", type: "email" },
      { name: "Password", label: "Password", value: "", type: "password" }
    ],
    onOpen: ({ form }) => enhancePasswordEditorField(form),
    transformPayload: ({ payload }) => ({
      Username: payload.Username?.trim(),
      Email: payload.Email?.trim(),
      Password: payload.Password?.trim()
    }),
    submitHandler: async ({ payload }) => {
      return fetch(`${DB_BASE}/Login`, {
        method: "POST",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
    }
  });
}

function goToUserView() {
  clearStoredAdminUser();
  window.location.href = "../index.html";
}

function logoutToAdminLogin() {
  clearStoredAdminUser();
  window.location.href = "./index.html";
}
