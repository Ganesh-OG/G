import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG, getStorage } from "./config.js";
import { addEditButton, openEditor } from "./editor-tools.js";
import { createCircularSlider } from "../../components/circular-slider.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let connectionRows = [];
let connectionCategoryRows = [];
const ALL_CATEGORY = "all";

document.addEventListener("DOMContentLoaded", loadConnections);

async function loadConnections() {
  try {
    const [rows, categories] = await Promise.all([
      getTable("connections"),
      getTable("connection_category")
    ]);
    connectionRows = rows;
    connectionCategoryRows = categories;
    renderConnectionsPage(connectionRows);
    ensureConnectionsManagerModal();
  } catch (error) {
    console.error("Error fetching connections:", error);
  }
}

function prettifyCategory(category) {
  return String(category || "").replaceAll("_", " ");
}

function normalizeCategory(category) {
  return String(category || "").trim().toLowerCase();
}

function parsePriorityArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }

  const normalized = String(value || "").trim();
  if (!normalized) return [];

  if (normalized.startsWith("[")) {
    try {
      return parsePriorityArray(JSON.parse(normalized));
    } catch (error) {
      console.warn("Failed to parse priority JSON array:", error);
    }
  }

  return normalized
    .replace(/^\[|\]$/g, "")
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => Number(item.replace(/"/g, "").trim()))
    .filter((item) => Number.isFinite(item));
}

function stringifyPriorityArray(value) {
  return parsePriorityArray(value).join(", ");
}

function getCategoryPriority(categoryRows, category) {
  const row = categoryRows.find((item) => normalizeCategory(item.category) === normalizeCategory(category));
  return parsePriorityArray(row?.priority);
}

function sortRowsByPriority(rows, categoryRows, category) {
  const priorityIds = getCategoryPriority(categoryRows, category);
  const priorityIndex = new Map(priorityIds.map((id, index) => [Number(id), index]));
  const prioritized = [];
  const remaining = [];

  rows.forEach((row) => {
    const rowId = Number(row.id);
    if (priorityIndex.has(rowId)) prioritized.push(row);
    else remaining.push(row);
  });

  prioritized.sort((a, b) => priorityIndex.get(Number(a.id)) - priorityIndex.get(Number(b.id)));
  return [...prioritized, ...remaining];
}

function copyText(value) {
  if (!value) return;
  navigator.clipboard?.writeText(String(value)).catch(() => {});
}

function buildConnectionPriorityGroups(category) {
  const normalized = normalizeCategory(category);
  const rows = getVisibleConnectionRows(connectionRows);

  if (!normalized || normalized === ALL_CATEGORY) {
    return connectionCategoryRows
      .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
      .map((row) => ({
        title: row.label || prettifyCategory(row.category),
        items: sortRowsByPriority(
          rows.filter((item) => normalizeCategory(item.category) === normalizeCategory(row.category)),
          connectionCategoryRows,
          row.category
        )
      }))
      .filter((group) => group.items.length);
  }

  return [{
    title: prettifyCategory(category),
    items: sortRowsByPriority(
      rows.filter((item) => normalizeCategory(item.category) === normalized),
      connectionCategoryRows,
      category
    )
  }];
}

function mountConnectionPriorityHelper(fieldsContainer, getCategoryValue) {
  fieldsContainer.classList.add("admin-editor-fields--split");

  let helper = fieldsContainer.querySelector(".admin-priority-helper");
  if (!helper) {
    helper = document.createElement("aside");
    helper.className = "admin-priority-helper";
    fieldsContainer.appendChild(helper);
  }

  const render = () => {
    const category = getCategoryValue()?.trim() || ALL_CATEGORY;
    const groups = buildConnectionPriorityGroups(category);

    helper.innerHTML = `
      <div class="admin-priority-helper-header">
        <h4>Reference IDs</h4>
        <p>${normalizeCategory(category) === ALL_CATEGORY ? "All categories" : prettifyCategory(category)}</p>
      </div>
      <div class="admin-priority-helper-groups">
        ${groups.length ? groups.map((group) => `
          <section class="admin-priority-helper-group">
            <h5>${group.title}</h5>
            ${group.items.map((item) => `
              <div class="admin-priority-helper-item">
                <div>
                  <strong>${item.name || "Unnamed Connection"}</strong>
                  <span>ID: ${item.id}</span>
                </div>
                <button type="button" class="admin-project-manager-btn" data-copy-id="${item.id}">Copy</button>
              </div>
            `).join("")}
          </section>
        `).join("") : `<p class="admin-priority-helper-empty">No matching connections yet.</p>`}
      </div>
    `;

    helper.querySelectorAll("[data-copy-id]").forEach((button) => {
      button.addEventListener("click", () => copyText(button.dataset.copyId));
    });
  };

  render();
  return render;
}

function isRealConnection(row) {
  return Boolean(
    row?.name ||
    row?.role ||
    row?.specialisation ||
    row?.working_at ||
    row?.experience ||
    row?.image ||
    row?.email ||
    row?.phone ||
    row?.instagram ||
    row?.facebook ||
    row?.twitter ||
    row?.linkedin ||
    row?.href
  );
}

function isPlaceholderConnection(row) {
  return Boolean(row?.category) && !isRealConnection(row);
}

function getVisibleConnectionRows(rows) {
  return rows.filter(isRealConnection);
}

function getCategoryOptions(rows) {
  return connectionCategoryRows
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || prettifyCategory(row.category)
    }));
}

function buildConnectionSocials(item) {
  return [
    item.email ? `
      <a class="connection-social-link" href="mailto:${item.email}" aria-label="Email ${item.name}">
        <img src="./assets/images/logo/E-mail.png" alt="Email" width="20" height="20">
      </a>` : "",
    item.phone ? `
      <a class="connection-social-link" href="tel:${item.phone}" aria-label="Call ${item.name}">
        <img src="./assets/images/logo/Phone.png" alt="Phone" width="20" height="20">
      </a>` : "",
    item.instagram ? `
      <a class="connection-social-link" href="${item.instagram}" target="_blank" rel="noopener" aria-label="Instagram ${item.name}">
        <img src="./assets/images/logo/Instagram.png" alt="Instagram" width="20" height="20">
      </a>` : "",
    item.facebook ? `
      <a class="connection-social-link" href="${item.facebook}" target="_blank" rel="noopener" aria-label="Facebook ${item.name}">
        <img src="./assets/images/logo/Facebook.png" alt="Facebook" width="20" height="20">
      </a>` : "",
    item.twitter ? `
      <a class="connection-social-link" href="${item.twitter}" target="_blank" rel="noopener" aria-label="X ${item.name}">
        <img src="./assets/images/logo/X-Corp.png" alt="X" width="20" height="20">
      </a>` : "",
    item.linkedin ? `
      <a class="connection-social-link" href="${item.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn ${item.name}">
        <img src="./assets/images/logo/Linked-In.png" alt="LinkedIn" width="20" height="20">
      </a>` : "",
    item.href ? `
      <a class="connection-social-link" href="${item.href}" target="_blank" rel="noopener" aria-label="Website ${item.name}">
        <ion-icon name="globe-outline"></ion-icon>
      </a>` : ""
  ].filter(Boolean).join("");
}

function getConnectionFields(row = {}) {
  return [
    {
      name: "category",
      value: row.category || "",
      type: "select",
      options: [
        ...getCategoryOptions(connectionRows),
        { value: "custom", label: "Add New Category" }
      ]
    },
    { name: "category_name", label: "Category Name", value: row.category || "" },
    { name: "name", value: row.name || "" },
    { name: "role", value: row.role || "" },
    { name: "specialisation", value: row.specialisation || "", type: "textarea" },
    { name: "working_at", value: row.working_at || "" },
    { name: "experience", value: row.experience || "", type: "textarea" },
    { name: "image", value: row.image || "", type: "image", storageFolder: "Connections" },
    { name: "email", value: row.email || "", type: "email" },
    { name: "phone", value: row.phone || "" },
    { name: "instagram", value: row.instagram || "", type: "url" },
    { name: "facebook", value: row.facebook || "", type: "url" },
    { name: "twitter", value: row.twitter || "", type: "url" },
    { name: "linkedin", value: row.linkedin || "", type: "url" },
    { name: "href", value: row.href || "", type: "url" }
  ];
}

function normalizeConnectionPayload(payload) {
  return {
    category: payload.category?.trim() || null,
    name: payload.name?.trim() || null,
    role: payload.role?.trim() || null,
    specialisation: payload.specialisation?.trim() || null,
    working_at: payload.working_at?.trim() || null,
    experience: payload.experience?.trim() || null,
    image: payload.image?.trim() || null,
    email: payload.email?.trim() || null,
    phone: payload.phone?.trim() || null,
    instagram: payload.instagram?.trim() || null,
    facebook: payload.facebook?.trim() || null,
    twitter: payload.twitter?.trim() || null,
    linkedin: payload.linkedin?.trim() || null,
    href: payload.href?.trim() || null
  };
}

async function ensureConnectionCategoryExists(category) {
  if (!category) return;
  const exists = connectionCategoryRows.some((row) => row.category === category);
  if (exists) return;

  await fetch(`${DB_BASE}/connection_category`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      category,
      label: prettifyCategory(category)
    })
  });
}

async function submitConnectionEditor({ table, rowId, method, payload, headers, dbBase }) {
  const requestUrl = method === "POST"
    ? `${dbBase}/${table}`
    : `${dbBase}/${table}?id=eq.${encodeURIComponent(rowId)}`;

  await ensureConnectionCategoryExists(payload.category);

  const response = await fetch(requestUrl, {
    method,
    headers: {
      ...headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return response;
  }
  return response;
}

function renderConnectionsPage(rows) {
  const article = document.querySelector('article.portfolio[data-page="connections"]');
  const header = article?.querySelector("header");
  const filterList = document.getElementById("filter-list");
  const selectList = document.getElementById("select-list");
  const projectList = document.getElementById("project-list");

  if (!article || !header || !filterList || !selectList || !projectList) {
    return;
  }

  const existingHeaderRow = header.querySelector(".admin-section-header");
  existingHeaderRow?.remove();

  const title = header.querySelector(".article-title");
  if (title) {
    const titleRow = document.createElement("div");
    titleRow.className = "admin-section-header";
    titleRow.appendChild(title);

    const manageButton = document.createElement("button");
    manageButton.type = "button";
    manageButton.className = "admin-inline-action-btn";
    manageButton.textContent = "Manage Connections";
    manageButton.addEventListener("click", openConnectionsManager);
    titleRow.appendChild(manageButton);
    header.appendChild(titleRow);
  }

  const categories = getCategoryOptions(rows);
  const visibleRows = sortRowsByPriority(getVisibleConnectionRows(rows), connectionCategoryRows, ALL_CATEGORY);

  filterList.innerHTML = `
    <li class="filter-item">
      <button class="active" data-filter-btn="all">All</button>
    </li>
    ${categories.map(({ value, label }) => `
      <li class="filter-item">
        <button data-filter-btn="${value}">${label}</button>
      </li>
    `).join("")}
  `;

  selectList.innerHTML = `
    <li class="select-item">
      <button data-select-item="all">All</button>
    </li>
    ${categories.map(({ value, label }) => `
      <li class="select-item">
        <button data-select-item="${value}">${label}</button>
      </li>
    `).join("")}
  `;

  projectList.innerHTML = visibleRows.map((item) => {
    const image = getStorage("Connections", item.image);
    const socials = buildConnectionSocials(item);

    return `
      <li class="project-item connection-card-item" data-filter-item data-category="${item.category || ""}" data-row-id="${item.id}">
        <div class="connection-card">
          <figure class="connection-card__image-wrap">
            <img class="connection-card__image" src="${image}" alt="${item.name}" loading="lazy">
          </figure>
          <div class="connection-card__body">
            <h3 class="connection-card__name">${item.name || ""}</h3>
            ${item.role ? `<p class="connection-card__role">${item.role}</p>` : ""}
            ${item.specialisation ? `<p class="connection-card__meta"><strong>Specialisation</strong><span>${item.specialisation}</span></p>` : ""}
            ${item.working_at ? `<p class="connection-card__meta"><strong>Work</strong><span>${item.working_at}</span></p>` : ""}
            ${item.experience ? `<p class="connection-card__meta"><strong>Experience</strong><span>${item.experience}</span></p>` : ""}
            ${socials ? `<div class="connection-card__socials">${socials}</div>` : ""}
          </div>
        </div>
      </li>
    `;
  }).join("");

  visibleRows.forEach((item) => {
    const card = projectList.querySelector(`[data-row-id="${item.id}"]`);
    if (!card) return;

    addEditButton(card, {
      table: "connections",
      row: item,
      title: item.name || "Connection",
      fields: getConnectionFields(item),
      onBack: openConnectionsManager,
      transformPayload: ({ payload }) => normalizeConnectionPayload({
        ...payload,
        category: payload.category === "custom" ? payload.category_name : payload.category
      }),
      submitHandler: (args) => submitConnectionEditor(args)
    });
  });

  projectList.querySelectorAll("[data-filter-item]").forEach((item) => {
    item.setAttribute("data-slider-active", "true");
  });

  const slider = createCircularSlider(projectList, {
    desktop: 3,
    mobile: 1,
    selector: "[data-filter-item]"
  });

  const filterButtonsElements = article.querySelectorAll("[data-filter-btn]");
  filterButtonsElements.forEach((button) => {
    button.addEventListener("click", function () {
      const category = this.getAttribute("data-filter-btn");

      article.querySelectorAll("[data-filter-item]").forEach((item) => {
        const isVisible = category === "all" || item.getAttribute("data-category") === category;
        item.setAttribute("data-slider-active", isVisible ? "true" : "false");
      });

      const sortedRows = category === ALL_CATEGORY
        ? sortRowsByPriority(getVisibleConnectionRows(rows), connectionCategoryRows, ALL_CATEGORY)
        : sortRowsByPriority(
            rows.filter((row) => normalizeCategory(row.category) === normalizeCategory(category) && isRealConnection(row)),
            connectionCategoryRows,
            category
          );

      sortedRows.forEach((row) => {
        const item = projectList.querySelector(`[data-row-id="${row.id}"]`);
        if (item) projectList.appendChild(item);
      });

      slider?.refresh(true);

      filterButtonsElements.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");
    });
  });

  const selectButtons = article.querySelectorAll("[data-select-item]");
  const dropdownMenu = document.getElementById("select-list");
  const selectValue = article.querySelector("[data-select-value]");
  if (selectValue) {
    selectValue.textContent = "All";
  }
  selectButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const category = this.getAttribute("data-select-item");
      const filterButton = article.querySelector(`[data-filter-btn="${category}"]`);

      if (filterButton) {
        filterButton.click();
      }

      const selectValue = article.querySelector("[data-select-value]");
      if (selectValue) {
        selectValue.textContent = this.textContent;
      }

      dropdownMenu.style.display = "none";
    });
  });

  const defaultAllButton = article.querySelector('[data-filter-btn="all"]');
  defaultAllButton?.click();
}

function openAddConnectionEditor() {
  openEditor({
    table: "connections",
    title: "Add Connection",
    method: "POST",
    fields: getConnectionFields(),
    onOpen: ({ form }) => {
      const categorySelect = form.querySelector('[name="category"]');
      const categoryInput = form.querySelector('[name="category_name"]');
      categorySelect?.addEventListener("change", () => {
        if (categorySelect.value !== "custom") {
          categoryInput.value = categorySelect.value;
        } else if (getCategoryOptions(connectionRows).some((item) => item.value === categoryInput.value)) {
          categoryInput.value = "";
        }
      });
    },
    onBack: openConnectionsManager,
    transformPayload: ({ payload }) => normalizeConnectionPayload({
      ...payload,
      category: payload.category === "custom" ? payload.category_name : payload.category
    }),
    submitHandler: (args) => submitConnectionEditor(args)
  });
}

function openEditConnectionEditor(connection) {
  openEditor({
    table: "connections",
    row: connection,
    title: connection.name || "Connection",
    fields: getConnectionFields(connection),
    onOpen: ({ form }) => {
      const categorySelect = form.querySelector('[name="category"]');
      const categoryInput = form.querySelector('[name="category_name"]');
      categorySelect?.addEventListener("change", () => {
        if (categorySelect.value !== "custom") {
          categoryInput.value = categorySelect.value;
        } else if (getCategoryOptions(connectionRows).some((item) => item.value === categoryInput.value)) {
          categoryInput.value = "";
        }
      });
    },
    onBack: openConnectionsManager,
    transformPayload: ({ payload }) => normalizeConnectionPayload({
      ...payload,
      category: payload.category === "custom" ? payload.category_name : payload.category
    }),
    submitHandler: (args) => submitConnectionEditor(args)
  });
}

function openAddConnectionCategoryEditor() {
  openEditor({
    table: "connection_category",
    title: "Add Connection Category",
    method: "POST",
    fields: [
      { name: "category", label: "Category Name", value: "" },
      { name: "priority", label: "Priority IDs", value: "", type: "textarea" }
    ],
    onOpen: ({ form, fieldsContainer }) => {
      const categoryInput = form.querySelector('[name="category"]');
      const rerender = mountConnectionPriorityHelper(fieldsContainer, () => categoryInput?.value);
      categoryInput?.addEventListener("input", rerender);
    },
    onBack: openConnectionsManager,
    transformPayload: ({ payload }) => ({
      category: payload.category?.trim() || null,
      label: prettifyCategory(payload.category?.trim() || ""),
      priority: parsePriorityArray(payload.priority)
    })
  });
}

function openEditConnectionCategoryEditor(category) {
  const categoryRow = connectionCategoryRows.find((row) => row.category === category);
  if (!categoryRow) return;

  openEditor({
    table: "connection_category",
    row: categoryRow,
    title: `Edit Category: ${prettifyCategory(category)}`,
    method: "PATCH",
    fields: [
      { name: "old_category", label: "Current Category", value: category },
      { name: "new_category", label: "New Category Name", value: category },
      { name: "priority", label: "Priority IDs", value: stringifyPriorityArray(categoryRow.priority), type: "textarea" }
    ],
    onOpen: ({ form, fieldsContainer }) => {
      const oldInput = form.querySelector('[name="old_category"]');
      const newInput = form.querySelector('[name="new_category"]');
      const rerender = mountConnectionPriorityHelper(fieldsContainer, () => newInput?.value || oldInput?.value);
      newInput?.addEventListener("input", rerender);
    },
    onBack: openConnectionsManager,
    transformPayload: ({ payload }) => ({
      old_category: payload.old_category?.trim(),
      new_category: payload.new_category?.trim(),
      priority: parsePriorityArray(payload.priority)
    }),
    submitHandler: async ({ payload }) => {
      const categoryResponse = await fetch(`${DB_BASE}/connection_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category: payload.new_category,
          label: prettifyCategory(payload.new_category),
          priority: payload.priority
        })
      });

      if (!categoryResponse.ok) {
        return categoryResponse;
      }

      await fetch(`${DB_BASE}/connections?category=eq.${encodeURIComponent(payload.old_category)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category: payload.new_category
        })
      });

      return categoryResponse;
    }
  });
}

async function deleteConnectionCategory(category) {
  const categoryRow = connectionCategoryRows.find((row) => row.category === category);
  const confirmed = window.confirm(`Delete category "${prettifyCategory(category)}" and all connections inside it?`);
  if (!confirmed || !categoryRow) return;

  try {
    const connectionsResponse = await fetch(`${DB_BASE}/connections?category=eq.${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!connectionsResponse.ok) {
      throw new Error(await connectionsResponse.text());
    }

    const categoryResponse = await fetch(`${DB_BASE}/connection_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!categoryResponse.ok) {
      throw new Error(await categoryResponse.text());
    }

    window.location.reload();
  } catch (error) {
    window.alert(`Failed to delete category.\n${error.message}`);
  }
}

async function deleteConnection(connection) {
  const confirmed = window.confirm(`Delete ${connection.name || "this connection"}?`);
  if (!confirmed) return;

  const response = await fetch(`${DB_BASE}/connections?id=eq.${encodeURIComponent(connection.id)}`, {
    method: "DELETE",
    headers: {
      ...HEADERS,
      Prefer: "return=minimal"
    }
  });

  if (!response.ok) {
    window.alert(`Failed to delete ${connection.name || "connection"}.`);
    return;
  }

  window.location.reload();
}

function ensureConnectionsManagerModal() {
  if (document.getElementById("admin-connections-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-connections-manager";
  modal.className = "admin-project-manager";
  modal.innerHTML = `
    <div class="admin-project-manager-backdrop" data-close-connections-manager></div>
    <section class="admin-project-manager-panel">
      <div class="admin-project-manager-header">
        <div>
          <p class="admin-project-manager-kicker">Connections</p>
          <h3>Manage Connections</h3>
        </div>
        <button type="button" class="admin-project-manager-close" data-close-connections-manager aria-label="Close connections manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-project-manager-toolbar">
        <button type="button" class="admin-project-manager-add-category" data-add-connection-category>Add Category</button>
        <button type="button" class="admin-project-manager-add-project" data-add-connection>Add Connection</button>
      </div>
      <div class="admin-project-manager-sections">
        <section>
          <h4 class="admin-project-manager-subtitle">Categories</h4>
          <div class="admin-project-category-list" id="admin-connection-category-list"></div>
        </section>
        <section>
          <h4 class="admin-project-manager-subtitle">Connections</h4>
          <div class="admin-project-list-manager" id="admin-connection-list"></div>
        </section>
      </div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-connections-manager]")) {
      closeConnectionsManager();
    }
  });

  modal.querySelector("[data-add-connection-category]").addEventListener("click", () => {
    closeConnectionsManager();
    openAddConnectionCategoryEditor();
  });

  modal.querySelector("[data-add-connection]").addEventListener("click", () => {
    closeConnectionsManager();
    openAddConnectionEditor();
  });
}

function renderConnectionsManager() {
  const categoryList = document.getElementById("admin-connection-category-list");
  const connectionList = document.getElementById("admin-connection-list");

  if (!categoryList || !connectionList) {
    return;
  }

  const categories = connectionCategoryRows
    .filter((row) => row.category)
    .map((row) => ({
      value: row.category,
      label: row.label || prettifyCategory(row.category)
    }));
  const visibleRows = getVisibleConnectionRows(connectionRows);

  categoryList.innerHTML = categories.length ? "" : `<div class="admin-project-manager-empty">No categories yet.</div>`;
  categories.forEach(({ value, label }) => {
    const categoryRow = connectionCategoryRows.find((row) => row.category === value);
    const priorityText = stringifyPriorityArray(categoryRow?.priority);
    const card = document.createElement("div");
    card.className = "admin-project-category-card";
    card.innerHTML = `
      <div>
        <strong>${label}</strong>
        <span>${connectionRows.filter((row) => row.category === value && isRealConnection(row)).length} connection(s)</span>
        <span>${priorityText ? `Priority: ${priorityText}` : "Priority: None"}</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-category">Edit Category</button>
        <button type="button" class="admin-project-manager-btn danger" data-action="delete-category">Delete Category</button>
      </div>
    `;

    card.querySelector('[data-action="edit-category"]').addEventListener("click", () => {
      closeConnectionsManager();
      openEditConnectionCategoryEditor(value);
    });
    card.querySelector('[data-action="delete-category"]').addEventListener("click", () => {
      closeConnectionsManager();
      deleteConnectionCategory(value);
    });

    categoryList.appendChild(card);
  });

  connectionList.innerHTML = visibleRows.length ? "" : `<div class="admin-project-manager-empty">No connections yet.</div>`;
  visibleRows.forEach((connection) => {
    const card = document.createElement("div");
    card.className = "admin-project-card";
    card.innerHTML = `
      <div>
        <strong>${connection.name || "Unnamed Connection"}</strong>
        <span>${prettifyCategory(connection.category)}${connection.role ? ` • ${connection.role}` : ""}</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-connection">Edit</button>
        <button type="button" class="admin-project-manager-btn danger" data-action="delete-connection">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit-connection"]').addEventListener("click", () => {
      closeConnectionsManager();
      openEditConnectionEditor(connection);
    });

    card.querySelector('[data-action="delete-connection"]').addEventListener("click", () => {
      closeConnectionsManager();
      deleteConnection(connection);
    });

    connectionList.appendChild(card);
  });
}

function openConnectionsManager() {
  renderConnectionsManager();
  const modal = document.getElementById("admin-connections-manager");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeConnectionsManager() {
  const modal = document.getElementById("admin-connections-manager");
  if (modal) {
    modal.classList.remove("active");
  }
}
