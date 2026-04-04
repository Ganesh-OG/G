import { getTable } from "./db.js";
import { openEditor } from "./editor-tools.js";
import { DB_BASE } from "./config.js";

let interestsRows = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    interestsRows = await getTable("interests");
    // insertInterestsManagerTrigger(); // Disabled to remove admin UI from Editor.html sidebar
    // ensureInterestsManagerModal(); // Disabled to remove admin UI from Editor.html sidebar
  } catch (error) {
    console.error("Error fetching interests:", error);
  }
});

function insertInterestsManagerTrigger() {
  const serviceList = document.querySelector(".service-list");
  if (!serviceList || serviceList.querySelector(".interests-manager-trigger")) return;

  const managerItem = document.createElement("li");
  managerItem.className = "service-item interests-manager-item";
  managerItem.innerHTML = `
    <button type="button" class="admin-interests-manager-trigger" aria-label="Manage interests">
      <span class="admin-interests-manager-ring">
        <ion-icon name="settings-outline"></ion-icon>
      </span>
    </button>
  `;
  managerItem.querySelector("button").addEventListener("click", openInterestsManager);
  serviceList.appendChild(managerItem);
}

function ensureInterestsManagerModal() {
  if (document.getElementById("admin-interests-manager")) return;

  const modal = document.createElement("div");
  modal.id = "admin-interests-manager";
  modal.className = "admin-interests-manager";
  modal.innerHTML = `
    <div class="admin-interests-manager-backdrop" data-close-interests-manager></div>
    <section class="admin-interests-manager-panel">
      <div class="admin-interests-manager-header">
        <div>
          <p class="admin-interests-manager-kicker">Personal Interests</p>
          <h3>Manage Interests</h3>
        </div>
        <button type="button" class="admin-interests-manager-close" data-close-interests-manager>
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-interests-manager-toolbar">
        <button type="button" class="admin-interests-manager-add">Add Interest</button>
      </div>
      <div class="admin-interests-manager-list"></div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-interests-manager]")) closeInterestsManager();
  });

  modal.querySelector(".admin-interests-manager-add").addEventListener("click", () => {
    openEditor({
      table: "interests",
      title: "Add Interest",
      method: "POST",
      fields: [
        { name: "title", label: "Title" },
        { name: "message", label: "Description", type: "textarea" },
        { name: "image", label: "Icon Image", type: "image", storageFolder: "Interests" }
      ]
    });
    closeInterestsManager();
  });
}

function renderInterestsManagerList() {
  const list = document.querySelector(".admin-interests-manager-list");
  if (!list) return;

  if (!interestsRows.length) {
    list.innerHTML = '<div class="admin-interests-manager-empty">No interests yet. Add one!</div>';
    return;
  }

  list.innerHTML = "";

  interestsRows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "admin-interests-manager-card";
    card.innerHTML = `
      <div class="admin-interests-manager-card-main">
        <img src="${getStorage('Interests', row.image)}" alt="${row.title}" width="32">
        <div class="admin-interests-manager-copy">
          <strong>${row.title}</strong>
          <span>${row.message.substring(0, 60)}...</span>
        </div>
      </div>
      <div class="admin-interests-manager-actions">
        <button type="button" class="admin-interests-manager-btn" data-action="edit">Edit</button>
        <button type="button" class="admin-interests-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openEditor({
        table: "interests",
        row,
        title: row.title,
        fields: [
          { name: "title", value: row.title },
          { name: "message", value: row.message, type: "textarea" },
          { 
            name: "image", 
            value: row.image,
            type: "image",
            storageFolder: "Interests",
            uploadBaseName: row.title
          }
        ],
        transformPayload: ({ payload }) => ({
          title: payload.title?.trim(),
          message: payload.message?.trim() || null,
          image: payload.image || null
        })
      });
      closeInterestsManager();
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm(`Delete "${row.title}"?`)) {
        await fetch(`${DB_BASE}/interests?id=eq.${row.id}`, { method: "DELETE" });
        window.location.reload();
      }
    });

    list.appendChild(card);
  });
}

function openInterestsManager() {
  renderInterestsManagerList();
  document.getElementById("admin-interests-manager").classList.add("active");
}

function closeInterestsManager() {
  document.getElementById("admin-interests-manager")?.classList.remove("active");
}

