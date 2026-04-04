import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let skillRows = [];

export async function loadSkills() {

  try {

    const data = await getTable("technical_skills");
    skillRows = data;

    generateSkillsSection(data);

  }
  catch (error) {

    console.error("Error fetching technical skills:", error);

  }

}

function generateSkillsSection(data) {

  const section = document.createElement("section");
  section.className = "skill";

  const title = document.createElement("h3");
  title.className = "h3 skills-title";
  title.textContent = "Technical Skills";
  const titleRow = document.createElement("div");
  titleRow.className = "admin-section-header";
  titleRow.appendChild(title);
  const manageButton = document.createElement("button");
  manageButton.type = "button";
  manageButton.className = "admin-inline-action-btn";
  manageButton.textContent = "Manage Skills";
  manageButton.addEventListener("click", openSkillsManager);
  titleRow.appendChild(manageButton);
  section.appendChild(titleRow);

  const ul = document.createElement("ul");
  ul.className = "skills-list content-card";

  data.forEach(skill => {

    const li = document.createElement("li");
    li.className = "skills-item";

    const titleWrapper = document.createElement("div");
    titleWrapper.className = "title-wrapper";

    const h5 = document.createElement("h5");
    h5.className = "h5";
    h5.textContent = skill.language;
    titleWrapper.appendChild(h5);

    const dataElem = document.createElement("data");
    dataElem.value = skill.percentage;
    dataElem.textContent = `${skill.percentage}%`;
    titleWrapper.appendChild(dataElem);

    li.appendChild(titleWrapper);

    const progressBg = document.createElement("div");
    progressBg.className = "skill-progress-bg";

    const progressFill = document.createElement("div");
    progressFill.className = "skill-progress-fill";
    progressFill.style.width = `${skill.percentage}%`;

    progressBg.appendChild(progressFill);

    li.appendChild(progressBg);
    ul.appendChild(li);

  });

  section.appendChild(ul);

  const resumeArticle = document.querySelector('article.resume[data-page="resume"]');

  if (resumeArticle) {
    resumeArticle.appendChild(section);
  }

  ensureSkillsManagerModal();

}

function openAddSkillEditor() {
  openEditor({
    table: "technical_skills",
    title: "Add Technical Skill",
    method: "POST",
    fields: [
      { name: "language", value: "" },
      { name: "percentage", value: "" }
    ],
    onBack: openSkillsManager,
    transformPayload: ({ payload }) => ({
      language: payload.language?.trim(),
      percentage: payload.percentage?.trim() || null
    })
  });
}

function openEditSkillEditor(skill) {
  openEditor({
    table: "technical_skills",
    row: skill,
    title: skill.language || "Technical Skill",
    onBack: openSkillsManager,
    fields: [
      { name: "language", value: skill.language },
      { name: "percentage", value: skill.percentage }
    ]
  });
}

async function deleteSkill(id, label) {
  const confirmed = window.confirm(`Delete ${label}?`);
  if (!confirmed) return;

  const response = await fetch(`${DB_BASE}/technical_skills?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      ...HEADERS,
      Prefer: "return=minimal"
    }
  });

  if (!response.ok) {
    window.alert(`Failed to delete ${label}.`);
    return;
  }

  window.location.reload();
}

function ensureSkillsManagerModal() {
  if (document.getElementById("admin-skills-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-skills-manager";
  modal.className = "admin-social-manager";
  modal.innerHTML = `
    <div class="admin-social-manager-backdrop" data-close-skills-manager></div>
    <section class="admin-social-manager-panel">
      <div class="admin-social-manager-header">
        <div>
          <p class="admin-social-manager-kicker">Technical Skills</p>
          <h3>Manage Skills</h3>
        </div>
        <button type="button" class="admin-social-manager-close" data-close-skills-manager aria-label="Close skills manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-social-manager-toolbar">
        <button type="button" class="admin-social-manager-add" data-add-skill>Add New</button>
      </div>
      <div class="admin-social-manager-list" id="admin-skills-list"></div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-skills-manager]")) {
      closeSkillsManager();
    }
  });

  modal.querySelector("[data-add-skill]").addEventListener("click", () => {
    closeSkillsManager();
    openAddSkillEditor();
  });
}

function renderSkillsManager() {
  const list = document.getElementById("admin-skills-list");
  if (!list) return;

  if (!skillRows.length) {
    list.innerHTML = `<div class="admin-social-manager-empty">No skills yet. Add one to get started.</div>`;
    return;
  }

  list.innerHTML = "";

  skillRows.forEach((skill) => {
    const card = document.createElement("div");
    card.className = "admin-social-manager-card";
    card.innerHTML = `
      <div class="admin-social-manager-card-main">
        <div class="admin-social-manager-copy">
          <strong>${skill.language || "Unnamed Skill"}</strong>
          <span>${skill.percentage ?? "0"}%</span>
        </div>
      </div>
      <div class="admin-social-manager-actions">
        <button type="button" class="admin-social-manager-btn" data-action="edit">Edit</button>
        <button type="button" class="admin-social-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      closeSkillsManager();
      openEditSkillEditor(skill);
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      closeSkillsManager();
      deleteSkill(skill.id, skill.language || "skill");
    });

    list.appendChild(card);
  });
}

function openSkillsManager() {
  renderSkillsManager();
  const modal = document.getElementById("admin-skills-manager");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeSkillsManager() {
  const modal = document.getElementById("admin-skills-manager");
  if (modal) {
    modal.classList.remove("active");
  }
}
