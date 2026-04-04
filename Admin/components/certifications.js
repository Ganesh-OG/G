import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG, getStorage } from "./config.js";
import { addEditButton, openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let certificationRows = [];

async function fetchAndUpdateCertifications() {

  try {

    const certifications = await getTable("certifications");
    certificationRows = certifications;

    const article = document.querySelector('article.blog[data-page="blog"]');
    const header = article?.querySelector("header");

    if (!certifications || !article || !header) {
      console.error("Certifications or DOM elements missing");
      return;
    }

    const existingList = article.querySelector(".blog-posts-list");
    existingList?.remove();

    const existingControls = header.querySelector(".admin-section-header");
    existingControls?.remove();

    const title = header.querySelector(".article-title");
    if (title) {
      const titleRow = document.createElement("div");
      titleRow.className = "admin-section-header";
      titleRow.appendChild(title);

      const manageButton = document.createElement("button");
      manageButton.type = "button";
      manageButton.className = "admin-inline-action-btn";
      manageButton.textContent = "Manage Certifications";
      manageButton.addEventListener("click", openCertificationsManager);
      titleRow.appendChild(manageButton);
      header.appendChild(titleRow);
    }

    const ul = document.createElement("ul");
    ul.className = "blog-posts-list";

    certifications.forEach(cert => {

      const imageURL = getStorage("Certifications", cert.file_name);

      const li = document.createElement("li");
      li.className = "blog-post-item";

      li.innerHTML = `
        <a href="${cert.cert_link}" target="_blank">

          <figure class="blog-banner-box">
            <img src="${imageURL}" alt="${cert.title}" loading="lazy">
          </figure>

          <div class="blog-content">

            <div class="blog-meta">
              <p class="blog-category">${cert.provider}</p>
              <span class="dot"></span>

              <time datetime="${cert.completion_date}">
                ${cert.completion_date}
              </time>
            </div>

            <h3 class="h3 blog-item-title">${cert.title}</h3>

            <p class="blog-text">
              ${cert.message}
            </p>

          </div>

        </a>
      `;

      addEditButton(li, {
        table: "certifications",
        row: cert,
        title: cert.title || "Certification",
        fields: [
          { name: "title", value: cert.title },
          { name: "provider", value: cert.provider },
          { name: "completion_date", value: cert.completion_date, type: "date" },
          { name: "message", value: cert.message, type: "textarea" },
          { name: "file_name", value: cert.file_name, type: "image", storageFolder: "Certifications" },
          { name: "cert_link", value: cert.cert_link, type: "url" }
        ]
      });

      ul.appendChild(li);

    });

    article.insertBefore(ul, header.nextSibling);
    ensureCertificationsManagerModal();

  } catch (error) {
    console.error("Error fetching certifications:", error);
  }

}

function openAddCertificationEditor() {
  openEditor({
    table: "certifications",
    title: "Add Certification",
    method: "POST",
    fields: [
      { name: "title", value: "" },
      { name: "provider", value: "" },
      { name: "completion_date", value: "", type: "date" },
      { name: "message", value: "", type: "textarea" },
      { name: "file_name", value: "", type: "image", storageFolder: "Certifications" },
      { name: "cert_link", value: "", type: "url" }
    ],
    onBack: openCertificationsManager,
    transformPayload: ({ payload }) => ({
      title: payload.title?.trim() || null,
      provider: payload.provider?.trim() || null,
      completion_date: payload.completion_date || null,
      message: payload.message?.trim() || null,
      file_name: payload.file_name?.trim() || null,
      cert_link: payload.cert_link?.trim() || null
    })
  });
}

function openEditCertificationEditor(cert) {
  openEditor({
    table: "certifications",
    row: cert,
    title: cert.title || "Certification",
    onBack: openCertificationsManager,
    fields: [
      { name: "title", value: cert.title },
      { name: "provider", value: cert.provider },
      { name: "completion_date", value: cert.completion_date, type: "date" },
      { name: "message", value: cert.message, type: "textarea" },
      { name: "file_name", value: cert.file_name, type: "image", storageFolder: "Certifications" },
      { name: "cert_link", value: cert.cert_link, type: "url" }
    ]
  });
}

async function deleteCertification(cert) {
  const confirmed = window.confirm(`Delete ${cert.title || "this certification"}?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${DB_BASE}/certifications?id=eq.${encodeURIComponent(cert.id)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    window.location.reload();
  } catch (error) {
    window.alert(`Failed to delete certification.\n${error.message}`);
  }
}

function ensureCertificationsManagerModal() {
  if (document.getElementById("admin-certifications-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-certifications-manager";
  modal.className = "admin-social-manager";
  modal.innerHTML = `
    <div class="admin-social-manager-backdrop" data-close-certifications-manager></div>
    <section class="admin-social-manager-panel">
      <div class="admin-social-manager-header">
        <div>
          <p class="admin-social-manager-kicker">Certifications</p>
          <h3>Manage Certifications</h3>
        </div>
        <button type="button" class="admin-social-manager-close" data-close-certifications-manager aria-label="Close certifications manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-social-manager-toolbar">
        <button type="button" class="admin-social-manager-add" data-add-certification>Add New</button>
      </div>
      <div class="admin-social-manager-list" id="admin-certifications-list"></div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-certifications-manager]")) {
      closeCertificationsManager();
    }
  });

  modal.querySelector("[data-add-certification]").addEventListener("click", () => {
    closeCertificationsManager();
    openAddCertificationEditor();
  });
}

function renderCertificationsManager() {
  const list = document.getElementById("admin-certifications-list");
  if (!list) return;

  if (!certificationRows.length) {
    list.innerHTML = `<div class="admin-social-manager-empty">No certifications yet. Add one to get started.</div>`;
    return;
  }

  list.innerHTML = "";

  certificationRows.forEach((cert) => {
    const card = document.createElement("div");
    card.className = "admin-social-manager-card";
    card.innerHTML = `
      <div class="admin-social-manager-card-main">
        <div class="admin-social-manager-copy">
          <strong>${cert.title || "Untitled Certification"}</strong>
          <span>${cert.provider || "No provider"}${cert.completion_date ? ` • ${cert.completion_date}` : ""}</span>
        </div>
      </div>
      <div class="admin-social-manager-actions">
        <button type="button" class="admin-social-manager-btn" data-action="edit">Edit</button>
        <button type="button" class="admin-social-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      closeCertificationsManager();
      openEditCertificationEditor(cert);
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      closeCertificationsManager();
      deleteCertification(cert);
    });

    list.appendChild(card);
  });
}

function openCertificationsManager() {
  renderCertificationsManager();
  const modal = document.getElementById("admin-certifications-manager");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeCertificationsManager() {
  const modal = document.getElementById("admin-certifications-manager");
  if (modal) {
    modal.classList.remove("active");
  }
}

document.addEventListener("DOMContentLoaded", fetchAndUpdateCertifications);
