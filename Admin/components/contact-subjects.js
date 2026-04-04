import { openEditor } from "./editor-tools.js";

const STORAGE_KEY = "portfolioContactSubjects";

const DEFAULT_SUBJECTS = [
  { value: "Build-connection", label: "Just Wanted To Connect" },
  { value: "job-offer", label: "Job Offer" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "other", label: "Other" }
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadSubjects() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [...DEFAULT_SUBJECTS];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_SUBJECTS];
  } catch (error) {
    console.error("Failed to load contact subjects:", error);
    return [...DEFAULT_SUBJECTS];
  }
}

function saveSubjects(subjects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
}

function renderSubjectOptions() {
  const select = document.querySelector('select[name="subject"]');
  if (!select) return;

  const subjects = loadSubjects();
  select.innerHTML = `
    <option value="">Select a subject</option>
    ${subjects.map((subject) => `
      <option value="${String(subject.value).replace(/"/g, "&quot;")}">${subject.label}</option>
    `).join("")}
  `;
}

function ensureContactSubjectManager() {
  if (document.getElementById("admin-contact-subjects-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-contact-subjects-manager";
  modal.className = "admin-social-manager";
  modal.innerHTML = `
    <div class="admin-social-manager-backdrop" data-close-contact-subjects></div>
    <section class="admin-social-manager-panel">
      <div class="admin-social-manager-header">
        <div>
          <p class="admin-social-manager-kicker">Contact</p>
          <h3>Manage Subjects</h3>
        </div>
        <button type="button" class="admin-social-manager-close" data-close-contact-subjects aria-label="Close subject manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-social-manager-toolbar">
        <button type="button" class="admin-social-manager-add" data-add-contact-subject>Add Subject</button>
      </div>
      <div class="admin-social-manager-list" id="admin-contact-subjects-list"></div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-contact-subjects]")) {
      closeContactSubjectManager();
    }
  });

  modal.querySelector("[data-add-contact-subject]").addEventListener("click", () => {
    closeContactSubjectManager();
    openAddSubjectEditor();
  });
}

function renderContactSubjectManager() {
  const list = document.getElementById("admin-contact-subjects-list");
  if (!list) return;

  const subjects = loadSubjects();

  if (!subjects.length) {
    list.innerHTML = `<div class="admin-social-manager-empty">No subjects yet. Add one to get started.</div>`;
    return;
  }

  list.innerHTML = "";

  subjects.forEach((subject, index) => {
    const card = document.createElement("div");
    card.className = "admin-social-manager-card";
    card.innerHTML = `
      <div class="admin-social-manager-card-main">
        <div class="admin-social-manager-copy">
          <strong>${subject.label}</strong>
          <span>${subject.value}</span>
        </div>
      </div>
      <div class="admin-social-manager-actions">
        <button type="button" class="admin-social-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      const nextSubjects = loadSubjects();
      nextSubjects.splice(index, 1);
      saveSubjects(nextSubjects);
      renderSubjectOptions();
      renderContactSubjectManager();
    });

    list.appendChild(card);
  });
}

function openContactSubjectManager() {
  renderContactSubjectManager();
  const modal = document.getElementById("admin-contact-subjects-manager");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeContactSubjectManager() {
  const modal = document.getElementById("admin-contact-subjects-manager");
  if (modal) {
    modal.classList.remove("active");
  }
}

function openAddSubjectEditor() {
  openEditor({
    table: "contact_subjects",
    title: "Add Contact Subject",
    method: "POST",
    fields: [
      { name: "label", value: "" },
      { name: "value", value: "" }
    ],
    onBack: openContactSubjectManager,
    showBackButton: true,
    submitHandler: async ({ payload }) => {
      const label = payload.label?.trim();
      const value = payload.value?.trim() || slugify(label);

      if (!label) {
        return new Response("Subject label is required.", { status: 400 });
      }

      const subjects = loadSubjects();
      subjects.push({ label, value });
      saveSubjects(subjects);
      renderSubjectOptions();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    },
    transformPayload: ({ payload }) => ({
      label: payload.label?.trim(),
      value: payload.value?.trim()
    })
  });
}

function insertContactSubjectButton() {
  const article = document.querySelector('article.contact[data-page="contact"]');
  const header = article?.querySelector("header");
  const title = header?.querySelector(".article-title");

  if (!article || !header || !title || header.querySelector(".admin-section-header")) {
    return;
  }

  const row = document.createElement("div");
  row.className = "admin-section-header";
  row.appendChild(title);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-inline-action-btn";
  button.textContent = "Manage Subjects";
  button.addEventListener("click", openContactSubjectManager);
  row.appendChild(button);
  header.appendChild(row);
}

document.addEventListener("DOMContentLoaded", () => {
  renderSubjectOptions();
  ensureContactSubjectManager();
  insertContactSubjectButton();
});
