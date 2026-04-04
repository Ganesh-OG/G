import { getTable } from "./db.js";
import { getStorage, DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let projectRows = [];
let projectCategoryRows = [];

function getProjectCategoryOptions() {
  return projectCategoryRows
    .filter((row) => row.category)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category
    }));
}

async function ensureProjectCategoryExists(category) {
  if (!category) return;
  const exists = projectCategoryRows.some((row) => row.category === category);
  if (exists) return;

  await fetch(`${DB_BASE}/project_category`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      category,
      label: category
    })
  });
}

async function populateProjects() {

  try {

    const [rows, categories] = await Promise.all([
      getTable("projects"),
      getTable("project_category")
    ]);
    projectRows = rows;
    projectCategoryRows = categories;

    const modalContainer = document.querySelector('[data-modal-container]');
    if (!modalContainer) {
      console.warn('Modal container not found');
      return;
    }

    const newContent = document.createElement('section');
    newContent.className = 'projects';

    newContent.innerHTML = `
      <ul class="filter-list"></ul>

      <div class="filter-select-box">
        <button class="filter-select" project-select>
          <div class="select-value" project-select-value></div>
          <div class="select-icon">
            <ion-icon name="chevron-down"></ion-icon>
          </div>
        </button>

        <ul class="select-list"></ul>
      </div>

      <ul class="project-list"></ul>
    `;

    modalContainer.insertAdjacentElement('afterend', newContent);

    const filterList = newContent.querySelector('.filter-list');
    const selectList = newContent.querySelector('.select-list');
    const projectList = newContent.querySelector('.project-list');
    const projectSelectValue = newContent.querySelector("[project-select-value]");

    const fallbackImageUrl = getStorage("Projects", "404.gif");

    const categories = getProjectCategoryOptions();

    const managerWrap = document.createElement("div");
    managerWrap.className = "admin-project-manager-launch";
    managerWrap.innerHTML = `
      <button type="button" class="admin-project-manager-trigger" aria-label="Manage projects">
        <span class="admin-project-manager-ring">
          <ion-icon name="layers-outline"></ion-icon>
        </span>
      </button>
    `;
    newContent.prepend(managerWrap);
    ensureProjectManagerModal();
    managerWrap.querySelector("button").addEventListener("click", openProjectManager);

    // =============================
    // ADD DEFAULT ALL
    // =============================
    filterList.innerHTML += `
      <li class="filter-item">
        <button class="active" project-filter-btn>All</button>
      </li>
    `;

    selectList.innerHTML += `
      <li class="select-item">
        <button project-select-item>All</button>
      </li>
    `;

    categories.forEach(({ value, label }) => {

      filterList.innerHTML += `
        <li class="filter-item">
          <button project-filter-btn data-category="${value}">${label}</button>
        </li>
      `;

      selectList.innerHTML += `
        <li class="select-item">
          <button project-select-item data-category="${value}">${label}</button>
        </li>
      `;

    });

    rows.forEach(project => {

      if (!project.name) return;

      const formattedCategory = project.category || "other";

      const projectItem = document.createElement('li');
      projectItem.className = 'project-item';
      projectItem.setAttribute('project-filter-item', '');
      projectItem.setAttribute('data-category', formattedCategory);

      // ✅ NEW DATA ATTRIBUTES
      projectItem.dataset.action = project.action_type?.toLowerCase();
      projectItem.dataset.key = project.project_key;
      projectItem.dataset.url = project.link;

      let imageUrl = project.file
        ? getStorage("Projects", project.file)
        : fallbackImageUrl;

      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.alt = project.name;
      imgElement.width = 40;
      imgElement.loading = "lazy";

      imgElement.onerror = () => {
        imgElement.src = fallbackImageUrl;
      };

      let titleText = project.name;
      if (project.project_date) {
        titleText += ` : ${project.project_date}`;
      }

      let descriptionHTML = "";
      if (project.description) {
        descriptionHTML = `
          <p class="project-category experience">
            <strong>Description:</strong> ${project.description}
          </p>
        `;
      }

      let contentHTML = `
        <figure class="project-img">
          ${imgElement.outerHTML}
        </figure>

        <h3 class="project-title">
          ${titleText}
        </h3>
      `;

      projectItem.innerHTML = `
        ${contentHTML}
        ${descriptionHTML}
      `;

      projectList.appendChild(projectItem);

    });

    attachEventListeners(newContent);

  }

  catch (error) {
    console.error("Error fetching projects:", error);
  }

}

// =============================
// EVENTS + FILTER + CLICK
// =============================
function attachEventListeners(container) {

  const projectSelect = container.querySelector("[project-select]");
  const projectSelectItems = container.querySelectorAll("[project-select-item]");
  const projectSelectValue = container.querySelector("[project-select-value]");
  const projectFilterBtn = container.querySelectorAll("[project-filter-btn]");
  const projectFilterItems = container.querySelectorAll("[project-filter-item]");

  // =============================
  // FILTER FUNCTION
  // =============================
  const projectFilterFunc = function (selectedValue) {

    projectFilterItems.forEach(item => {

      if (selectedValue === "all" || selectedValue === item.dataset.category) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }

    });

  };

  // =============================
  // DEFAULT LOAD (MOBILE + DESKTOP)
  // =============================
  projectFilterFunc("all");

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    projectSelectValue.innerText = "Select category";
  } else {
    projectSelectValue.innerText = "All";
  }

  // =============================
  // SELECT DROPDOWN
  // =============================
  if (projectSelect) {
    projectSelect.addEventListener("click", function () {
      elementToggleFunc(this);
    });
  }

  projectSelectItems.forEach(item => {

    item.addEventListener("click", function () {

      let selectedValue = this.innerText
        .toLowerCase()
        .replace(/ /g, "-");
      const rawCategory = this.dataset.category || selectedValue;

      projectSelectValue.innerText = this.innerText;

      if (projectSelect) elementToggleFunc(projectSelect);

      projectFilterFunc(rawCategory);

    });

  });

  // =============================
  // BUTTON FILTER
  // =============================
  let lastTouchedButton = projectFilterBtn[0];

  projectFilterBtn.forEach(btn => {

    btn.addEventListener("click", function () {

      let selectedValue = this.innerText
        .toLowerCase()
        .replace(/ /g, "-");
      const rawCategory = this.dataset.category || selectedValue;

      projectSelectValue.innerText = this.innerText;

      projectFilterFunc(rawCategory);

      if (lastTouchedButton) {
        lastTouchedButton.classList.remove("active");
      }

      this.classList.add("active");
      lastTouchedButton = this;

    });

  });

  // =============================
  // CLICK HANDLER (POPUP / REDIRECT)
  // =============================
  projectFilterItems.forEach(item => {

    item.addEventListener("click", async function () {

      const action = this.dataset.action;
      const key = this.dataset.key;
      const url = this.dataset.url;

      if (action === "redirect" && url) {
        window.open(url, "_blank");
        return;
      }

      if (action === "popup" && key) {

        const popup = document.getElementById("popup");
        const content = document.getElementById("popup-content");

        popup.style.display = "block";
        content.innerHTML = "Loading...";

        try {
          const { data, error } = await window.supabase
            .from("project_details")
            .select("content")
            .eq("project_key", key)
            .single();

          if (error) throw error;

          content.innerHTML = data.content;

        } catch (err) {
          content.innerHTML = "Error loading project";
          console.error(err);
        }
      }

    });

  });

  // =============================
  // OPTIONAL: HANDLE RESIZE
  // =============================
  window.addEventListener("resize", () => {
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      projectSelectValue.innerText = "Select category";
    } else {
      projectSelectValue.innerText = "All";
    }
  });

}

function getProjectCategories() {
  return getProjectCategoryOptions().map((item) => item.value);
}

function openProjectEditor(project, forcedCategory = "") {
  const categories = getProjectCategories();
  const initialCategory = forcedCategory || project?.category || categories[0] || "";

  openEditor({
    table: "projects",
    row: project,
    method: project?.id ? "PATCH" : "POST",
    title: project?.id ? (project.name || "Edit Project") : "Add Project",
    fields: [
      {
        name: "category_select",
        label: "Category",
        type: "select",
        value: initialCategory || "custom",
        options: [
          ...getProjectCategoryOptions(),
          { value: "custom", label: "Add New Category" }
        ]
      },
      { name: "category", label: "Category Name", value: initialCategory },
      { name: "name", value: project?.name || "" },
      { name: "project_date", value: project?.project_date || "" },
      { name: "description", value: project?.description || "", type: "textarea" },
      { name: "file", value: project?.file || "", type: "image", storageFolder: "Projects" },
      {
        name: "action_type",
        label: "Action Type",
        type: "select",
        value: project?.action_type || "redirect",
        options: [
          { value: "redirect", label: "Redirect" },
          { value: "popup", label: "Popup" }
        ]
      },
      { name: "project_key", value: project?.project_key || "" },
      { name: "link", label: "Link", value: project?.link || "", type: "url" }
    ],
    onOpen: ({ form }) => {
      const categorySelect = form.querySelector('[name="category_select"]');
      const categoryInput = form.querySelector('[name="category"]');

      categorySelect?.addEventListener("change", () => {
        if (categorySelect.value !== "custom") {
          categoryInput.value = categorySelect.value;
        } else if (getProjectCategories().includes(categoryInput.value)) {
          categoryInput.value = "";
        }
      });
    },
    onBack: openProjectManager,
    transformPayload: ({ payload }) => ({
      category: payload.category?.trim(),
      name: payload.name?.trim(),
      project_date: payload.project_date?.trim() || null,
      description: payload.description?.trim() || null,
      file: payload.file || null,
      action_type: payload.action_type?.trim(),
      project_key: payload.project_key?.trim() || null,
      link: payload.link?.trim() || null
    }),
    submitHandler: async ({ table, rowId, method, payload, headers, dbBase }) => {
      await ensureProjectCategoryExists(payload.category);
      return fetch(method === "POST" ? `${dbBase}/${table}` : `${dbBase}/${table}?id=eq.${encodeURIComponent(rowId)}`, {
        method,
        headers: {
          ...headers,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
    }
  });
}

function openRenameCategoryEditor(category) {
  const categoryRow = projectCategoryRows.find((row) => row.category === category);
  openEditor({
    table: "project_category",
    row: categoryRow,
    title: `Edit Category: ${category}`,
    method: "PATCH",
    fields: [
      { name: "old_category", label: "Current Category", value: category },
      { name: "new_category", label: "New Category Name", value: category }
    ],
    transformPayload: ({ payload }) => ({
      old_category: payload.old_category?.trim(),
      new_category: payload.new_category?.trim()
    }),
    onBack: openProjectManager,
    submitHandler: async ({ payload }) => {
      const categoryResponse = await fetch(`${DB_BASE}/project_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category: payload.new_category,
          label: payload.new_category
        })
      });

      if (!categoryResponse.ok) {
        return categoryResponse;
      }

      await fetch(`${DB_BASE}/projects?category=eq.${encodeURIComponent(payload.old_category)}`, {
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

function openAddCategoryFlow() {
  openEditor({
    table: "project_category",
    title: "Add New Category",
    method: "POST",
    fields: [
      { name: "new_category", label: "Category Name", value: "" }
    ],
    transformPayload: ({ payload }) => ({
      new_category: payload.new_category?.trim()
    }),
    onBack: openProjectManager,
    submitHandler: async ({ payload }) => {
      const categoryName = payload.new_category?.trim();

      if (!categoryName) {
        return new Response("Category name is required.", {
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }

      return fetch(`${DB_BASE}/project_category`, {
        method: "POST",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category: categoryName,
          label: categoryName
        })
      });
    }
  });
}

async function deleteProjectCategory(category) {
  const categoryRow = projectCategoryRows.find((row) => row.category === category);
  const confirmed = window.confirm(`Delete category "${category}" and all projects inside it?`);
  if (!confirmed || !categoryRow) return;

  try {
    const projectsResponse = await fetch(`${DB_BASE}/projects?category=eq.${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!projectsResponse.ok) {
      throw new Error(await projectsResponse.text());
    }

    const categoryResponse = await fetch(`${DB_BASE}/project_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
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

async function deleteProject(project) {
  const confirmed = window.confirm(`Delete project "${project.name}"?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${DB_BASE}/projects?id=eq.${encodeURIComponent(project.id)}`, {
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
    window.alert(`Failed to delete project.\n${error.message}`);
  }
}

function ensureProjectManagerModal() {
  if (document.getElementById("admin-project-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-project-manager";
  modal.className = "admin-project-manager";
  modal.innerHTML = `
    <div class="admin-project-manager-backdrop" data-close-project-manager></div>
    <section class="admin-project-manager-panel">
      <div class="admin-project-manager-header">
        <div>
          <p class="admin-project-manager-kicker">Projects</p>
          <h3>Manage Projects</h3>
        </div>
        <button type="button" class="admin-project-manager-close" data-close-project-manager aria-label="Close project manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-project-manager-toolbar">
        <button type="button" class="admin-project-manager-add-category">Add Category</button>
        <button type="button" class="admin-project-manager-add-project">Add Project</button>
      </div>
      <div class="admin-project-manager-sections">
        <div>
          <h4 class="admin-project-manager-subtitle">Categories</h4>
          <div class="admin-project-category-list"></div>
        </div>
        <div>
          <h4 class="admin-project-manager-subtitle">Projects</h4>
          <div class="admin-project-list-manager"></div>
        </div>
      </div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-project-manager]")) {
      closeProjectManager();
    }
  });

  modal.querySelector(".admin-project-manager-add-category").addEventListener("click", () => {
    closeProjectManager();
    openAddCategoryFlow();
  });

  modal.querySelector(".admin-project-manager-add-project").addEventListener("click", () => {
    closeProjectManager();
    openProjectEditor(null);
  });
}

function renderProjectManager() {
  const categoryList = document.querySelector(".admin-project-category-list");
  const projectList = document.querySelector(".admin-project-list-manager");
  if (!categoryList || !projectList) return;

  const categories = getProjectCategoryOptions();

  categoryList.innerHTML = categories.length
    ? ""
    : `<div class="admin-project-manager-empty">No categories yet. Add one to create your first project category.</div>`;

  categories.forEach(({ value, label }) => {
    const count = projectRows.filter((project) => project.category === value && project.name).length;
    const card = document.createElement("div");
    card.className = "admin-project-category-card";
    card.innerHTML = `
      <div>
        <strong>${label}</strong>
        <span>${count} project${count === 1 ? "" : "s"}</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-category">Edit Category</button>
        <button type="button" class="admin-project-manager-btn danger" data-action="delete-category">Delete Category</button>
      </div>
    `;
    card.querySelector('[data-action="edit-category"]').addEventListener("click", () => {
      closeProjectManager();
      openRenameCategoryEditor(value);
    });
    card.querySelector('[data-action="delete-category"]').addEventListener("click", () => {
      closeProjectManager();
      deleteProjectCategory(value);
    });
    categoryList.appendChild(card);
  });

  const visibleProjects = projectRows.filter((project) => project.name);
  projectList.innerHTML = visibleProjects.length
    ? ""
    : `<div class="admin-project-manager-empty">No projects yet. Add a project to get started.</div>`;

  visibleProjects.forEach((project) => {
    const card = document.createElement("div");
    card.className = "admin-project-card";
    card.innerHTML = `
      <div class="admin-project-card-main">
        <strong>${project.name || "Untitled Project"}</strong>
        <span>${project.category || "Uncategorized"}${project.project_date ? ` • ${project.project_date}` : ""}</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit">Edit Project</button>
        <button type="button" class="admin-project-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      closeProjectManager();
      openProjectEditor(project);
    });
    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      closeProjectManager();
      deleteProject(project);
    });
    projectList.appendChild(card);
  });
}

function openProjectManager() {
  renderProjectManager();
  const modal = document.getElementById("admin-project-manager");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeProjectManager() {
  const modal = document.getElementById("admin-project-manager");
  if (modal) {
    modal.classList.remove("active");
  }
}

populateProjects();
