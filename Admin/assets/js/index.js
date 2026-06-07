import { SUPABASE_CONFIG } from "../../components/config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

const form = document.getElementById("admin-login-form");
const statusEl = document.getElementById("error");

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
};

const setupPasswordToggle = (scope = document) => {
  scope.querySelectorAll("[data-password-toggle]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    const wrapper = button.closest(".admin-password-field");
    const input = wrapper?.querySelector("input");
    const icon = button.querySelector("ion-icon");
    if (!input || !icon) return;

    button.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      icon.setAttribute("name", visible ? "eye-outline" : "eye-off-outline");
      button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    });
  });
};

setupPasswordToggle();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.getElementById("loginInput")?.value.trim();
  const password = document.getElementById("password")?.value.trim();

  if (!input || !password) {
    setStatus("Please fill all fields.", true);
    return;
  }

  setStatus("Checking credentials...");

  try {
    const { data, error } = await supabase.from("Login").select("*");

    if (error || !data) {
      throw error || new Error("Unable to load users.");
    }

    const user = data.find((item) =>
      (item.Email?.toLowerCase() === input.toLowerCase() ||
       item.Username?.toLowerCase() === input.toLowerCase()) &&
      item.Password?.trim() === password
    );

    if (!user) {
      setStatus("Username or password is wrong.", true);
      return;
    }

    localStorage.setItem("adminUser", JSON.stringify(user));
    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = "Editor.html";
  } catch (error) {
    console.error("[ADMIN LOGIN] Failed:", error);
    setStatus("Something went wrong while signing in.", true);
  }
});
