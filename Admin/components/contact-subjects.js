import { openEditor } from "./editor-tools.js";
import { DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { getTable } from "./db.js";

const TABLE_NAME = "Connect_Subjects";
const DEFAULT_SUBJECTS = [
  { value: "Build-connection", label: "Just Wanted To Connect" },
  { value: "job-offer", label: "Job Offer" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "other", label: "Other" }
];

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let subjectRows = [];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchSubjectRows() {
  try {
    const rows = await getTable(TABLE_NAME);
    subjectRows = Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn(`Failed to fetch ${TABLE_NAME}; using defaults.`, error);
    subjectRows = DEFAULT_SUBJECTS.map((item, index) => ({
      id: index + 1,
      label: item.label,
      value: item.value
    }));
  }

  return subjectRows;
}

function getNormalizedSubjects() {
  return subjectRows.length
    ? subjectRows
    : DEFAULT_SUBJECTS.map((item, index) => ({
        id: index + 1,
        label: item.label,
        value: item.value
      }));
}

function renderSubjectOptions() {
  const select = document.querySelector('select[name="subject"]');
  if (!select) return;

  const subjects = getNormalizedSubjects();
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

async function renderContactSubjectManager() {
  const list = document.getElementById("admin-contact-subjects-list");
  if (!list) return;

  await fetchSubjectRows();
  const subjects = getNormalizedSubjects();

  if (!subjects.length) {
    list.innerHTML = `<div class="admin-social-manager-empty">No subjects yet. Add one to get started.</div>`;
    return;
  }

  list.innerHTML = "";

  subjects.forEach((subject) => {
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
        <button type="button" class="admin-social-manager-btn" data-action="edit">Edit</button>
        <button type="button" class="admin-social-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      closeContactSubjectManager();
      openEditSubjectEditor(subject);
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete subject "${subject.label}"?`);
      if (!confirmed) return;

      const response = await fetch(`${DB_BASE}/${TABLE_NAME}?id=eq.${encodeURIComponent(subject.id)}`, {
        method: "DELETE",
        headers: {
          ...HEADERS,
          Prefer: "return=minimal"
        }
      });

      if (!response.ok) {
        window.alert("Failed to delete subject.");
        return;
      }

      await fetchSubjectRows();
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
    table: TABLE_NAME,
    title: "Add Contact Subject",
    method: "POST",
    fields: [
      { name: "label", value: "" },
      { name: "value", value: "" }
    ],
    onBack: openContactSubjectManager,
    showBackButton: true,
    transformPayload: ({ payload }) => {
      const label = payload.label?.trim();
      return {
        label,
        value: payload.value?.trim() || slugify(label)
      };
    },
    submitHandler: async ({ payload }) => {
      if (!payload.label) {
        return new Response("Subject label is required.", { status: 400 });
      }

      const response = await fetch(`${DB_BASE}/${TABLE_NAME}`, {
        method: "POST",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchSubjectRows();
        renderSubjectOptions();
      }

      return response;
    }
  });
}

function openEditSubjectEditor(subject) {
  openEditor({
    table: TABLE_NAME,
    row: subject,
    title: `Edit Subject: ${subject.label}`,
    method: "PATCH",
    fields: [
      { name: "label", value: subject.label || "" },
      { name: "value", value: subject.value || "" }
    ],
    onBack: openContactSubjectManager,
    showBackButton: true,
    transformPayload: ({ payload }) => {
      const label = payload.label?.trim();
      return {
        label,
        value: payload.value?.trim() || slugify(label)
      };
    },
    submitHandler: async ({ payload, rowId }) => {
      if (!payload.label) {
        return new Response("Subject label is required.", { status: 400 });
      }

      const response = await fetch(`${DB_BASE}/${TABLE_NAME}?id=eq.${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchSubjectRows();
        renderSubjectOptions();
      }

      return response;
    }
  });
}

function insertContactSubjectButton() {
  const article = document.querySelector('article.contact[data-page="contact"]');
  const header = article?.querySelector("header");
  const title = header?.querySelector(".article-title");
  if (article && header && title && !header.querySelector(".admin-contact-subjects-header")) {
    const row = document.createElement("div");
    row.className = "admin-section-header admin-contact-subjects-header";
    row.appendChild(title);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-inline-action-btn";
    button.textContent = "Manage Subjects";
    button.addEventListener("click", openContactSubjectManager);
    row.appendChild(button);
    header.appendChild(row);
  }

  document.querySelector(".admin-contact-subjects-inline")?.remove();
}

document.addEventListener("DOMContentLoaded", async () => {
  await fetchSubjectRows();
  renderSubjectOptions();
  ensureContactSubjectManager();
  insertContactSubjectButton();
});
