import { getTable } from "./db.js";
import { getStorage, DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { openEditor, closeEditor } from "./editor-tools.js";
import { createCircularSlider } from "../../components/circular-slider.js";
import { openProjectPopup } from "../../components/project-popup.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let projectRows = [];
let projectCategoryRows = [];
const ALL_CATEGORY = "all";

function normalizeCategory(category) {
  return String(category || "").trim().toLowerCase();
}

function normalizeProjectAction(project = {}) {
  const preferredAction = String(project?.project_type || project?.action_type || "redirect")
    .trim()
    .toLowerCase();

  if (preferredAction === "file") return "file";
  if (preferredAction === "popup") return "popup";
  return "redirect";
}

function normalizeOrderKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeKeyLetters(value = "", fallback = "A") {
  const lettersOnly = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return lettersOnly || String(fallback || "A").toUpperCase().replace(/[^A-Z]/g, "") || "A";
}

function normalizeKeyDigits(value = "", fallback = "001") {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  return digitsOnly || String(fallback || "001").replace(/\D/g, "") || "001";
}

function getOrderKeyParts(value) {
  const normalized = normalizeOrderKey(value);
  const match = normalized.match(/^([a-z]*?)(\d+)$/i);

  if (match) {
    return {
      raw: normalized,
      prefix: match[1].toLowerCase(),
      number: Number(match[2]),
      hasNumber: true
    };
  }

  return {
    raw: normalized,
    prefix: normalized,
    number: Number.POSITIVE_INFINITY,
    hasNumber: false
  };
}

function formatOrderKey(prefix, number, width = 3) {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase();
  const paddedWidth = Math.max(Number(width) || 0, 3);
  return `${normalizedPrefix}${String(number).padStart(paddedWidth, "0")}`;
}

function compareOrderKeys(left, right) {
  const leftParts = getOrderKeyParts(left);
  const rightParts = getOrderKeyParts(right);

  if (leftParts.hasNumber && rightParts.hasNumber && leftParts.number !== rightParts.number) {
    return leftParts.number - rightParts.number;
  }

  if (leftParts.hasNumber !== rightParts.hasNumber) {
    return leftParts.hasNumber ? -1 : 1;
  }

  if (leftParts.prefix !== rightParts.prefix) {
    return leftParts.prefix.localeCompare(rightParts.prefix);
  }

  return leftParts.raw.localeCompare(rightParts.raw);
}

function getNextOrderKey(rows, fieldName, prefix, fallbackWidth = 3) {
  const normalizedPrefix = String(prefix || "").trim().toLowerCase() || "a";
  const matchingRows = rows.filter((row) => normalizeOrderKey(row?.[fieldName]).startsWith(normalizedPrefix));
  const width = matchingRows.reduce((maxWidth, row) => {
    const parts = getOrderKeyParts(row?.[fieldName]);
    return parts.hasNumber && parts.prefix === normalizedPrefix
      ? Math.max(maxWidth, String(Math.trunc(parts.number)).length)
      : maxWidth;
  }, Math.max(Number(fallbackWidth) || 3, 3));
  const maxNumber = matchingRows.reduce((max, row) => {
    const parts = getOrderKeyParts(row?.[fieldName]);
    if (!parts.hasNumber || parts.prefix !== normalizedPrefix) return max;
    return Math.max(max, parts.number);
  }, 0);

  return formatOrderKey(normalizedPrefix, maxNumber + 1, width);
}

function getCategoryLetterSeed(categoryName = "") {
  const match = String(categoryName || "")
    .trim()
    .toUpperCase()
    .match(/[A-Z]/);
  return match ? match[0] : "A";
}

function getCategoryKeyLetter(categoryName = "") {
  const row = projectCategoryRows.find((item) => normalizeCategory(item.category) === normalizeCategory(categoryName));
  return String(row?.Category_Key_letter || row?.category_key || "").trim().toUpperCase();
}

function getCategorySortKey(row = {}) {
  const keyValue =
    row?.Priority_key ??
    row?.priority_key ??
    row?.category_key ??
    row?.Category_Key_letter ??
    row?.label ??
    row?.category ??
    "";

  return String(keyValue).trim().toUpperCase();
}

function ensureCategoryLetter(categoryName = "", existingLetter = "") {
  const normalizedExisting = normalizeKeyLetters(existingLetter, "");
  if (normalizedExisting) return normalizedExisting;
  return getCategoryLetterSeed(categoryName);
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

function sortProjectsByPriority(rows, categoryRows, category, orderField = "all_Key") {
  const priorityIds = getCategoryPriority(categoryRows, category);
  const priorityIndex = new Map(priorityIds.map((id, index) => [Number(id), index]));
  return [...rows].sort((a, b) => {
    const keyComparison = compareOrderKeys(a?.[orderField], b?.[orderField]);
    if (keyComparison !== 0) return keyComparison;

    const aPriority = priorityIndex.has(Number(a?.id));
    const bPriority = priorityIndex.has(Number(b?.id));

    if (aPriority && bPriority) {
      return priorityIndex.get(Number(a.id)) - priorityIndex.get(Number(b.id));
    }

    if (aPriority !== bPriority) {
      return aPriority ? -1 : 1;
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" });
  });
}

function sortCategoriesByKey(rows) {
  return [...rows].sort((a, b) => {
    const aPriority = Number(a?.Priority_key ?? a?.priority_key);
    const bPriority = Number(b?.Priority_key ?? b?.priority_key);

    if (Number.isFinite(aPriority) && Number.isFinite(bPriority) && aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (Number.isFinite(aPriority) !== Number.isFinite(bPriority)) {
      return Number.isFinite(aPriority) ? -1 : 1;
    }

    const keyComparison = compareOrderKeys(getCategorySortKey(a), getCategorySortKey(b));
    if (keyComparison !== 0) return keyComparison;

    return String(a?.label || a?.category || "").localeCompare(String(b?.label || b?.category || ""), undefined, { sensitivity: "base" });
  });
}

function ensureProjectKey(existingKey = "", rows = projectRows) {
  const normalizedExisting = String(existingKey || "").trim();
  if (normalizedExisting) return normalizedExisting;
  return getNextOrderKey(rows, "all_Key", "a");
}

function ensureCategoryProjectKey(categoryName = "", existingKey = "", rows = projectRows) {
  const normalizedExisting = String(existingKey || "").trim();
  if (normalizedExisting) return normalizedExisting;
  const categoryLetter = getCategoryKeyLetter(categoryName) || getCategoryLetterSeed(categoryName);
  const scopedRows = rows.filter((row) => normalizeCategory(row.category) === normalizeCategory(categoryName));
  return getNextOrderKey(scopedRows, "category_key", categoryLetter);
}

async function updateProjectCategoryKeysForCategory(oldCategory, newCategory, newCategoryLetter) {
  const scopedProjects = projectRows.filter(
    (project) => project.name && normalizeCategory(project.category) === normalizeCategory(oldCategory)
  );

  if (!scopedProjects.length) return;

  const orderedProjects = sortProjectsByPriority(scopedProjects, projectCategoryRows, oldCategory, "category_key");
  const updates = orderedProjects.map((project, index) => {
    const keyParts = getOrderKeyParts(project.category_key);
    const numericPart = keyParts.hasNumber ? keyParts.number : (index + 1);
    const width = keyParts.hasNumber ? Math.max(String(Math.trunc(keyParts.number)).length, 3) : 3;

    return fetch(`${DB_BASE}/projects?id=eq.${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: {
        ...HEADERS,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        category: newCategory,
        category_key: formatOrderKey(newCategoryLetter, numericPart, width)
      })
    });
  });

  await Promise.all(updates);
}

function getAllProjectKeyPrefix() {
  const orderedProjects = sortProjectsByPriority(
    projectRows.filter((project) => project.name),
    projectCategoryRows,
    ALL_CATEGORY,
    "all_Key"
  );
  const firstKey = orderedProjects[0]?.all_Key || orderedProjects[0]?.all_key || "";
  const parts = getOrderKeyParts(firstKey);
  return (parts.prefix || "a").toUpperCase();
}

async function updateAllProjectKeys(nextPrefix) {
  const normalizedPrefix = String(nextPrefix || "").trim().toUpperCase();
  if (!normalizedPrefix) {
    throw new Error("All key prefix is required.");
  }

  const orderedProjects = sortProjectsByPriority(
    projectRows.filter((project) => project.name),
    projectCategoryRows,
    ALL_CATEGORY,
    "all_Key"
  );

  const changes = orderedProjects
    .map((project, index) => {
      const currentKey = String(project.all_Key || project.all_key || "").trim();
      const keyParts = getOrderKeyParts(currentKey);
      const numericPart = keyParts.hasNumber ? keyParts.number : (index + 1);
      const width = keyParts.hasNumber ? Math.max(String(Math.trunc(keyParts.number)).length, 3) : 3;
      const nextKey = formatOrderKey(normalizedPrefix, numericPart, width);

      if (nextKey === currentKey) return null;

      return {
        project,
        currentKey,
        nextKey
      };
    })
    .filter(Boolean);

  if (!changes.length) return;

  const projectUpdates = changes.map((change) => fetch(`${DB_BASE}/projects?id=eq.${encodeURIComponent(change.project.id)}`, {
    method: "PATCH",
    headers: {
      ...HEADERS,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      all_Key: change.nextKey
    })
  }));

  const results = await Promise.all(projectUpdates);
  const failed = results.find((response) => response && response.ok === false);

  if (failed) {
    const errorText = await failed.text();
    throw new Error(errorText || "Failed to update All keys.");
  }
}

function bindLettersOnlyInput(input, fallbackValue = "A") {
  if (!input) return;

  const syncValue = () => {
    const normalized = normalizeKeyLetters(input.value, fallbackValue);
    if (input.value !== normalized) {
      input.value = normalized;
    }
  };

  input.setAttribute("inputmode", "text");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", syncValue);
  input.addEventListener("blur", syncValue);
  syncValue();
}

function bindDigitsOnlyInput(input, fallbackValue = "001") {
  if (!input) return;

  const syncValue = () => {
    const normalized = normalizeKeyDigits(input.value, fallbackValue);
    if (input.value !== normalized) {
      input.value = normalized;
    }
  };

  input.setAttribute("inputmode", "numeric");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");
  input.addEventListener("input", syncValue);
  input.addEventListener("blur", syncValue);
  syncValue();
}

function copyText(value) {
  if (!value) return;
  navigator.clipboard?.writeText(String(value)).catch(() => {});
}

function buildProjectPriorityGroups(category) {
  const normalized = normalizeCategory(category);
  const rows = projectRows.filter((project) => project.name);

  if (!normalized || normalized === ALL_CATEGORY) {
    return projectCategoryRows
      .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
      .map((row) => ({
        title: row.label || row.category,
        items: sortProjectsByPriority(
          rows.filter((item) => normalizeCategory(item.category) === normalizeCategory(row.category)),
          projectCategoryRows,
          row.category,
          "category_key"
        )
      }))
      .filter((group) => group.items.length);
  }

  return [{
    title: category,
    items: sortProjectsByPriority(
      rows.filter((item) => normalizeCategory(item.category) === normalized),
      projectCategoryRows,
      category,
      "category_key"
    )
  }];
}

function mountProjectPriorityHelper(fieldsContainer, getCategoryValue) {
  fieldsContainer.classList.add("admin-editor-fields--split");

  let helper = fieldsContainer.querySelector(".admin-priority-helper");
  if (!helper) {
    helper = document.createElement("aside");
    helper.className = "admin-priority-helper";
    fieldsContainer.appendChild(helper);
  }

  const render = () => {
    const category = getCategoryValue()?.trim() || ALL_CATEGORY;
    const groups = buildProjectPriorityGroups(category);

    helper.innerHTML = `
      <div class="admin-priority-helper-header">
        <h4>Reference IDs</h4>
        <p>${normalizeCategory(category) === ALL_CATEGORY ? "All categories" : category}</p>
      </div>
      <div class="admin-priority-helper-groups">
        ${groups.length ? groups.map((group) => `
          <section class="admin-priority-helper-group">
            <h5>${group.title}</h5>
            ${group.items.map((item) => `
              <div class="admin-priority-helper-item">
                <div>
                  <strong>${item.name || "Untitled Project"}</strong>
                  <span>ID: ${item.id}</span>
                </div>
                <button type="button" class="admin-project-manager-btn" data-copy-id="${item.id}">Copy</button>
              </div>
            `).join("")}
          </section>
        `).join("") : `<p class="admin-priority-helper-empty">No matching projects yet.</p>`}
      </div>
    `;

    helper.querySelectorAll("[data-copy-id]").forEach((button) => {
      button.addEventListener("click", () => copyText(button.dataset.copyId));
    });
  };

  render();
  return render;
}

function getProjectCategoryOptions() {
  return sortCategoriesByKey(projectCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
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
      label: category,
      Category_Key_letter: ensureCategoryLetter(category)
    })
  });
}

async function populateProjects() {

  try {

    const [rows, categoryRows] = await Promise.all([
      getTable("projects"),
      getTable("project_category")
    ]);
    projectRows = rows;
    projectCategoryRows = categoryRows;

    const modalContainer = document.querySelector('[data-modal-container]');
    if (!modalContainer) {
      console.warn('Modal container not found');
      return;
    }

    const newContent = document.createElement('section');
    newContent.className = 'projects';

    newContent.innerHTML = `
      <div class="admin-project-filter-row">
        <ul class="filter-list"></ul>
      </div>

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

    const categoryOptions = getProjectCategoryOptions();

    const managerWrap = document.createElement("div");
    managerWrap.className = "admin-project-manager-launch";
    managerWrap.innerHTML = `
      <button type="button" class="admin-project-manager-trigger" aria-label="Manage projects">
        <span class="admin-project-manager-ring">
          <ion-icon name="layers-outline"></ion-icon>
        </span>
      </button>
    `;
    newContent.querySelector(".admin-project-filter-row")?.appendChild(managerWrap);
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

    categoryOptions.forEach(({ value, label }) => {

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

    sortProjectsByPriority(rows.filter((project) => project.name), projectCategoryRows, ALL_CATEGORY).forEach(project => {

      if (!project.name) return;

      const formattedCategory = project.category || "other";

      const projectItem = document.createElement('li');
      projectItem.className = 'project-item';
      projectItem.setAttribute('project-filter-item', '');
      projectItem.setAttribute('data-category', formattedCategory);
      projectItem.setAttribute('data-row-id', project.id);

      // ✅ NEW DATA ATTRIBUTES
      projectItem.dataset.action = normalizeProjectAction(project);
      projectItem.dataset.key = project.all_Key || project.all_key || project.project_key;
      projectItem.dataset.fileName = project.project_file_name || project.file || "";
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

    projectList.querySelectorAll("[project-filter-item]").forEach((item) => {
      item.setAttribute("data-slider-active", "true");
    });

    const slider = createCircularSlider(projectList, {
      desktop: 3,
      mobile: 1,
      selector: "[project-filter-item]"
    });

    attachEventListeners(newContent, slider);

  }

  catch (error) {
    console.error("Error fetching projects:", error);
  }

}

// =============================
// EVENTS + FILTER + CLICK
// =============================
function attachEventListeners(container, slider) {

  const projectSelect = container.querySelector("[project-select]");
  const projectSelectItems = container.querySelectorAll("[project-select-item]");
  const projectSelectValue = container.querySelector("[project-select-value]");
  const projectFilterBtn = container.querySelectorAll("[project-filter-btn]");
  const projectFilterItems = container.querySelectorAll("[project-filter-item]");
  const projectList = container.querySelector(".project-list");

  // =============================
  // FILTER FUNCTION
  // =============================
  const projectFilterFunc = function (selectedValue) {

    projectFilterItems.forEach(item => {

      const isVisible = selectedValue === "all" || selectedValue === item.dataset.category;
      item.setAttribute("data-slider-active", isVisible ? "true" : "false");

    });

    const sortedRows = selectedValue === ALL_CATEGORY
      ? sortProjectsByPriority(projectRows.filter((project) => project.name), projectCategoryRows, ALL_CATEGORY)
      : sortProjectsByPriority(
          projectRows.filter((project) => project.name && normalizeCategory(project.category) === normalizeCategory(selectedValue)),
          projectCategoryRows,
          selectedValue,
          "category_key"
        );

    sortedRows.forEach((project) => {
      const item = projectList.querySelector(`[data-row-id="${project.id}"]`);
      if (item) projectList.appendChild(item);
    });

    slider?.refresh(true);

  };

  // =============================
  // DEFAULT LOAD (MOBILE + DESKTOP)
  // =============================
  projectFilterFunc("all");

  projectSelectValue.innerText = "All";

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
  // CLICK HANDLER
  // =============================
  projectFilterItems.forEach(item => {

    item.addEventListener("click", async function (event) {
      event.preventDefault();
      event.stopPropagation();

      const action = this.dataset.action;
      const fileName = this.dataset.fileName;
      const url = this.dataset.url;

      if (action === "file") {
        await openProjectPopup({
          title: this.querySelector(".project-title")?.textContent?.trim(),
          fileName
        });
        return;
      }

      if (action === "redirect" && url) {
        window.open(url, "_blank");
        return;
      }

      if (action === "popup" && this.dataset.key) {
        try {
          const { data, error } = await window.supabase
            .from("project_details")
            .select("content")
            .eq("project_key", this.dataset.key)
            .single();

          if (error) throw error;
          openProjectPopup({
            title: this.querySelector(".project-title")?.textContent?.trim(),
            bundle: parseProjectDetailBundle(data.content)
          });

        } catch (err) {
          console.error(err);
        }
      }

    });

  });

  // =============================
  // OPTIONAL: HANDLE RESIZE
  // =============================
  window.addEventListener("resize", () => {
    projectSelectValue.innerText = "All";
  });

}

function getProjectCategories() {
  return getProjectCategoryOptions().map((item) => item.value);
}

function openProjectEditorFromManager(project = null) {
  openProjectEditor(project);
  window.setTimeout(() => {
    closeProjectManager();
  }, 0);
}

function openProjectEditor(project, forcedCategory = "") {
  const categories = getProjectCategories();
  const initialCategory = forcedCategory || project?.category || categories[0] || "";
  const initialAllKey = ensureProjectKey(project?.all_Key || project?.all_key);
  const initialCategoryKey = ensureCategoryProjectKey(initialCategory, project?.category_key);

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
        value: initialCategory,
        options: getProjectCategoryOptions()
      },
      {
        name: "all_Key",
        label: "All Key",
        value: initialAllKey,
        placeholder: "A001, A002, A003...",
        helpText: "This controls the order in the All projects list. We auto-fill the next available key when the field is blank."
      },
      {
        name: "category_key",
        label: "Category Key",
        value: initialCategoryKey,
        placeholder: "W001, W002, W003...",
        helpText: "This controls the order inside the selected category. We auto-fill from the category's key prefix."
      },
      { name: "name", value: project?.name || "" },
      { name: "project_date", value: project?.project_date || "" },
      { name: "description", value: project?.description || "", type: "textarea" },
      { name: "file", value: project?.file || "", type: "image", storageFolder: "Projects" },
      {
        name: "project_type",
        label: "Project Type",
        type: "select",
        value: project?.project_type || "website",
        options: [
          { value: "website", label: "Website" },
          { value: "file", label: "File" }
        ]
      },
      { name: "project_file_name", label: "JSON File Name", value: project?.project_file_name || "", placeholder: "Bulk_AD_User_Creation.json" },
      { name: "link", label: "Link", value: project?.link || "", type: "url" }
    ],
    onOpen: ({ form, fieldsContainer }) => {
      const categorySelect = form.querySelector('[name="category_select"]');
      const allKeyInput = form.querySelector('[name="all_Key"]');
      const categoryKeyInput = form.querySelector('[name="category_key"]');
      const syncProjectKeys = () => {
        if (allKeyInput) {
          const isAllKeyAuto = allKeyInput.dataset.autofilled !== "false";
          if (!String(allKeyInput.value || "").trim() || isAllKeyAuto) {
            allKeyInput.value = ensureProjectKey("");
            allKeyInput.dataset.autofilled = "true";
          }
        }

        if (categoryKeyInput) {
          const isCategoryKeyAuto = categoryKeyInput.dataset.autofilled !== "false";
          if (!String(categoryKeyInput.value || "").trim() || isCategoryKeyAuto) {
            categoryKeyInput.value = ensureCategoryProjectKey(categorySelect?.value || initialCategory, "");
            categoryKeyInput.dataset.autofilled = "true";
          }
        }
      };

      categorySelect?.addEventListener("change", () => {
        syncProjectKeys();
      });

      if (allKeyInput) {
        allKeyInput.dataset.autofilled = String(allKeyInput.value || "").trim() ? "false" : "true";
        allKeyInput.addEventListener("input", () => {
          allKeyInput.dataset.autofilled = "false";
        });
      }
      if (categoryKeyInput) {
        categoryKeyInput.dataset.autofilled = String(categoryKeyInput.value || "").trim() ? "false" : "true";
        categoryKeyInput.addEventListener("input", () => {
          categoryKeyInput.dataset.autofilled = "false";
        });
      }
      syncProjectKeys();
    },
    onBack: openProjectManager,
    transformPayload: ({ payload }) => {
      const normalizedName = payload.name?.trim();
      const normalizedAllKey = ensureProjectKey(payload.all_Key);
      const normalizedCategoryKey = ensureCategoryProjectKey(payload.category_select, payload.category_key);

      return {
        category: payload.category_select?.trim(),
        name: normalizedName,
        project_date: payload.project_date?.trim() || null,
        description: payload.description?.trim() || null,
        file: payload.file || null,
        project_type: payload.project_type || "website",
        project_file_name: payload.project_file_name?.trim() || null,
        all_Key: normalizedAllKey,
        category_key: normalizedCategoryKey,
        link: payload.link?.trim() || null
      };
    },
    submitHandler: async ({ table, rowId, method, payload, headers, dbBase }) => {
      await ensureProjectCategoryExists(payload.category);
      const response = await fetch(method === "POST" ? `${dbBase}/${table}` : `${dbBase}/${table}?id=eq.${encodeURIComponent(rowId)}`, {
        method,
        headers: {
          ...headers,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      return response;
    }
  });
}

function openRenameCategoryEditor(category) {
  const categoryRow = projectCategoryRows.find((row) => row.category === category);
  const initialCategoryKey = ensureCategoryLetter(category, categoryRow?.Category_Key_letter);
  openEditor({
    table: "project_category",
    row: categoryRow,
    title: `Edit Category: ${category}`,
    method: "PATCH",
    fields: [
      { name: "old_category", label: "Current Category", value: category },
      { name: "new_category", label: "New Category Name", value: category },
      {
        name: "Category_Key_letter",
        label: "Category Key Letter",
        value: initialCategoryKey,
        placeholder: "A, W, PS...",
        helpText: "This is the category prefix used for category ordering and project key grouping."
      }
    ],
    onOpen: ({ form, fieldsContainer }) => {
      const newInput = form.querySelector('[name="new_category"]');
      const keyInput = form.querySelector('[name="Category_Key_letter"]');
      const syncKey = () => {
        if (keyInput && !String(keyInput.value || "").trim()) {
          keyInput.value = ensureCategoryLetter(newInput?.value || category, keyInput.value);
        }
      };

      newInput?.addEventListener("input", syncKey);
      bindLettersOnlyInput(keyInput, ensureCategoryLetter(category, ""));
      syncKey();
    },
    transformPayload: ({ payload }) => ({
      old_category: payload.old_category?.trim(),
      new_category: payload.new_category?.trim(),
      Category_Key_letter: normalizeKeyLetters(payload.Category_Key_letter, ensureCategoryLetter(payload.new_category, ""))
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
          label: payload.new_category,
          Category_Key_letter: payload.Category_Key_letter
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

      await updateProjectCategoryKeysForCategory(
        payload.old_category,
        payload.new_category,
        payload.Category_Key_letter
      );

      return categoryResponse;
    }
  });
}

function openEditAllKeysEditor() {
  const initialAllKeyPrefix = getAllProjectKeyPrefix();

  openEditor({
    table: "projects",
    title: "Edit All Project Keys",
    method: "POST",
    refreshMode: "close",
    fields: [
      { name: "current_all_key_prefix", label: "Current All Key Prefix", value: initialAllKeyPrefix },
      {
        name: "new_all_key_prefix",
        label: "New All Key Prefix",
        value: initialAllKeyPrefix,
        placeholder: "A",
        helpText: "This updates every project's All Key and keeps the numeric order."
      }
    ],
    onOpen: ({ form }) => {
      const currentInput = form.querySelector('[name="current_all_key_prefix"]');
      const newInput = form.querySelector('[name="new_all_key_prefix"]');
      currentInput?.setAttribute("readonly", "readonly");
      currentInput?.setAttribute("tabindex", "-1");
      bindLettersOnlyInput(newInput, initialAllKeyPrefix);
      newInput?.focus();
    },
    transformPayload: ({ payload }) => ({
      current_all_key_prefix: payload.current_all_key_prefix?.trim(),
      new_all_key_prefix: normalizeKeyLetters(payload.new_all_key_prefix, initialAllKeyPrefix)
    }),
    submitHandler: async ({ payload }) => {
      await updateAllProjectKeys(payload.new_all_key_prefix);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    },
    onSaved: () => {
      window.location.reload();
    }
  });
}

function openAddCategoryFlow() {
  openEditor({
    table: "project_category",
    title: "Add New Category",
    method: "POST",
    fields: [
      { name: "new_category", label: "Category Name", value: "" },
      {
        name: "Category_Key_letter",
        label: "Category Key Letter",
        value: "",
        placeholder: "A, W, PS...",
        helpText: "This is the category prefix used for category ordering and project key grouping."
      }
    ],
    onOpen: ({ form, fieldsContainer }) => {
      const categoryInput = form.querySelector('[name="new_category"]');
      const keyInput = form.querySelector('[name="Category_Key_letter"]');
      const syncKey = () => {
        if (keyInput && !String(keyInput.value || "").trim()) {
          keyInput.value = ensureCategoryLetter(categoryInput?.value, keyInput.value);
        }
      };

      categoryInput?.addEventListener("input", syncKey);
      bindLettersOnlyInput(keyInput, "");
      syncKey();
    },
    transformPayload: ({ payload }) => ({
      new_category: payload.new_category?.trim(),
      Category_Key_letter: normalizeKeyLetters(payload.Category_Key_letter, ensureCategoryLetter(payload.new_category, ""))
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
          label: categoryName,
          Category_Key_letter: payload.Category_Key_letter
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
      <div class="admin-project-key-order">
        <div class="admin-project-key-order-header">
          <div>
            <h4 class="admin-project-manager-subtitle">Key Order</h4>
            <p>Category keys control category/filter order. All keys control the global project order.</p>
          </div>
          <button type="button" class="admin-project-manager-btn admin-project-key-order-save" data-save-key-order>Save Order</button>
        </div>
        <div class="admin-project-key-order-sections" data-key-order-sections></div>
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
    window.setTimeout(() => {
      openAddCategoryFlow();
    }, 0);
  });

  modal.querySelector(".admin-project-manager-add-project").addEventListener("click", () => {
    openProjectEditorFromManager(null);
  });

  modal.querySelector("[data-save-key-order]")?.addEventListener("click", async () => {
    await saveKeyOrder(modal);
  });
}

async function saveKeyOrder(modal) {
  const categoryInputs = Array.from(modal?.querySelectorAll('[data-order-input="project-category"]') || []);
  const projectInputs = Array.from(modal?.querySelectorAll('[data-order-input="project"]') || []);
  const updates = [];

  categoryInputs.forEach((input) => {
    const rowId = input.dataset.rowId;
    const row = projectRows.find((item) => String(item.id) === String(rowId));
    if (!row) return;

    const currentKey = String(row.category_key || "").trim();
    const currentParts = getOrderKeyParts(currentKey);
    const prefix = String(input.dataset.keyPrefix || currentParts.prefix || "").trim().toUpperCase();
    const width = Number(input.dataset.keyWidth || Math.max(String(Math.trunc(currentParts.number || 0) || 0).length, 3)) || 3;
    const nextKey = formatOrderKey(prefix || currentParts.prefix || "A", normalizeKeyDigits(input.value, currentParts.hasNumber ? String(currentParts.number).padStart(width, "0") : "001"), width);

    if (nextKey !== currentKey) {
      updates.push(fetch(`${DB_BASE}/projects?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category_key: nextKey
        })
      }));
    }
  });

  projectInputs.forEach((input) => {
    const rowId = input.dataset.rowId;
    const row = projectRows.find((item) => String(item.id) === String(rowId));
    if (!row) return;

    const currentKey = String(row.all_Key || row.all_key || "").trim();
    const currentParts = getOrderKeyParts(currentKey);
    const prefix = String(input.dataset.keyPrefix || currentParts.prefix || "").trim().toUpperCase();
    const width = Number(input.dataset.keyWidth || Math.max(String(Math.trunc(currentParts.number || 0) || 0).length, 3)) || 3;
    const nextKey = formatOrderKey(prefix || currentParts.prefix || "A", normalizeKeyDigits(input.value, currentParts.hasNumber ? String(currentParts.number).padStart(width, "0") : "001"), width);

    if (nextKey !== currentKey) {
      updates.push(fetch(`${DB_BASE}/projects?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          all_Key: nextKey
        })
      }));
    }
  });

  if (!updates.length) {
    window.alert("No key changes to save.");
    return;
  }

  const results = await Promise.all(updates);
  const failed = results.find((response) => !response.ok);

  if (failed) {
    const errorText = await failed.text();
    window.alert(`Failed to save key order.\n${errorText}`);
    return;
  }

  window.location.reload();
}

function renderProjectManager() {
  const modal = document.getElementById("admin-project-manager");
  const categoryList = modal?.querySelector(".admin-project-category-list");
  const projectList = modal?.querySelector(".admin-project-list-manager");
  const keyOrderSections = modal?.querySelector("[data-key-order-sections]");
  if (!categoryList || !projectList) return;

  const allProjectsCount = projectRows.filter((project) => project.name).length;
  const categories = sortCategoriesByKey(projectCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category
    }));

  categoryList.innerHTML = `
    <div class="admin-project-category-card admin-project-category-card--all">
      <div>
        <strong>All</strong>
        <span>${allProjectsCount} project${allProjectsCount === 1 ? "" : "s"}</span>
        <span>All Key order is managed here.</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-all-keys">Edit All</button>
      </div>
    </div>
    ${categories.length ? "" : `<div class="admin-project-manager-empty">No categories yet. Add one to create your first project category.</div>`}
  `;

  categories.forEach(({ value, label }) => {
    const count = projectRows.filter((project) => project.category === value && project.name).length;
    const categoryRow = projectCategoryRows.find((row) => row.category === value);
    const card = document.createElement("div");
    card.className = "admin-project-category-card";
    card.innerHTML = `
      <div>
        <strong>${label}</strong>
        <span>${count} project${count === 1 ? "" : "s"}</span>
        <span>Category Key Letter: ${categoryRow?.Category_Key_letter || "None"}</span>
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

  categoryList.querySelector('[data-action="edit-all-keys"]')?.addEventListener("click", () => {
    closeProjectManager();
    openEditAllKeysEditor();
  });

  const groupedProjectCategories = sortCategoriesByKey(projectCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category,
      projects: sortProjectsByPriority(
        projectRows.filter((project) => project.name && normalizeCategory(project.category) === normalizeCategory(row.category)),
        projectCategoryRows,
        row.category,
        "category_key"
      )
    }))
    .filter((group) => group.projects.length);

  const uncategorizedProjects = sortProjectsByPriority(
    projectRows.filter((project) => project.name && !String(project.category || "").trim()),
    projectCategoryRows,
    ALL_CATEGORY,
    "all_Key"
  );

  const projectGroups = [
    ...groupedProjectCategories,
    ...(uncategorizedProjects.length ? [{
      value: "uncategorized",
      label: "Uncategorized",
      projects: uncategorizedProjects
    }] : [])
  ];

  projectList.innerHTML = projectGroups.length
    ? ""
    : `<div class="admin-project-manager-empty">No projects yet. Add a project to get started.</div>`;

  projectGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "admin-project-group-section";
    section.dataset.projectGroupSection = "true";
    section.dataset.sectionOpen = "false";
    section.innerHTML = `
      <div class="admin-project-group-section-header">
        <button type="button" class="admin-project-group-toggle" data-project-group-toggle aria-expanded="false">
          <strong>${group.label}</strong>
          <span>${group.projects.length} project${group.projects.length === 1 ? "" : "s"}</span>
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-project-group-list" data-project-group-content hidden></div>
    `;

    const list = section.querySelector("[data-project-group-content]");
    group.projects.forEach((project) => {
      const card = document.createElement("div");
      card.className = "admin-project-card";
      card.innerHTML = `
        <div class="admin-project-card-main">
          <strong>${project.name || "Untitled Project"}</strong>
          <span>${project.category || "Uncategorized"}${project.project_date ? ` • ${project.project_date}` : ""}</span>
          <span>All Key: ${project.all_Key || project.all_key || "None"}</span>
        </div>
        <div class="admin-project-card-actions">
          <button type="button" class="admin-project-manager-btn" data-action="edit">Edit Project</button>
          <button type="button" class="admin-project-manager-btn danger" data-action="delete">Delete</button>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener("click", () => {
        openProjectEditorFromManager(project);
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", () => {
        closeProjectManager();
        deleteProject(project);
      });
      list.appendChild(card);
    });

    section.querySelector("[data-project-group-toggle]")?.addEventListener("click", () => {
      const isOpen = section.dataset.sectionOpen === "true";
      const nextOpen = !isOpen;
      section.dataset.sectionOpen = nextOpen ? "true" : "false";
      section.classList.toggle("admin-project-group-section--open", nextOpen);
      list.hidden = !nextOpen;
      section.querySelector("[data-project-group-toggle]")?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    });

    projectList.appendChild(section);
  });

  if (keyOrderSections) {
    const orderedAllProjects = sortProjectsByPriority(
      projectRows.filter((project) => project.name),
      projectCategoryRows,
      ALL_CATEGORY,
      "all_Key"
    );
    const orderedCategories = sortCategoriesByKey(projectCategoryRows).filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY);
    keyOrderSections.innerHTML = `
      <section class="admin-project-key-order-section" data-key-order-section data-section-open="false">
        <div class="admin-project-key-order-section-header">
          <button type="button" class="admin-project-key-order-toggle" data-key-order-toggle aria-expanded="false">
            <strong>All</strong>
            <ion-icon name="chevron-down-outline"></ion-icon>
          </button>
        </div>
        <div class="admin-project-key-order-list" data-key-order-content hidden>
          ${orderedAllProjects.length ? orderedAllProjects.map((project) => `
            <div class="admin-project-key-order-card">
              <div class="admin-project-key-order-card-main">
                <strong>${project.name || "Untitled Project"}</strong>
                <span>${project.category || "Uncategorized"}${project.project_date ? ` • ${project.project_date}` : ""}</span>
              </div>
              ${(() => {
                const keyParts = getOrderKeyParts(project.all_Key || project.all_key || "A001");
                const prefix = keyParts.prefix.toUpperCase() || "A";
                const numberText = keyParts.hasNumber ? String(keyParts.number).padStart(Math.max(String(Math.trunc(keyParts.number)).length, 3), "0") : "001";
                return `
                  <label class="admin-project-key-order-input">
                    <span>All Key</span>
                    <div class="admin-project-key-order-field">
                      <span class="admin-project-key-order-prefix">${prefix}</span>
                      <input
                        type="text"
                        value="${numberText.replace(/"/g, "&quot;")}"
                        data-order-input="project"
                        data-row-id="${project.id}"
                        data-key-prefix="${prefix}"
                        data-key-width="${Math.max(String(Math.trunc(keyParts.number || 0) || 0).length, 3)}"
                      >
                    </div>
                  </label>
                `;
              })()}
            </div>
          `).join("") : `<div class="admin-project-manager-empty">No projects yet.</div>`}
        </div>
      </section>
      ${orderedCategories.map((categoryRow) => {
        const projectsInCategory = sortProjectsByPriority(
          projectRows.filter((project) => project.name && normalizeCategory(project.category) === normalizeCategory(categoryRow.category)),
          projectCategoryRows,
          categoryRow.category,
          "category_key"
        );

        return `
          <section class="admin-project-key-order-section" data-key-order-section data-section-open="false">
            <div class="admin-project-key-order-section-header">
              <button type="button" class="admin-project-key-order-toggle" data-key-order-toggle aria-expanded="false">
                <strong>${categoryRow.label || categoryRow.category}</strong>
                <ion-icon name="chevron-down-outline"></ion-icon>
              </button>
            </div>
            <div class="admin-project-key-order-list" data-key-order-content hidden>
              ${projectsInCategory.length ? projectsInCategory.map((project) => `
                <div class="admin-project-key-order-card">
                  <div class="admin-project-key-order-card-main">
                    <strong>${project.name || "Untitled Project"}</strong>
                    <span>${project.category || "Uncategorized"}${project.project_date ? ` • ${project.project_date}` : ""}</span>
                  </div>
                  ${(() => {
                    const keyParts = getOrderKeyParts(project.category_key || "A001");
                    const prefix = keyParts.prefix.toUpperCase() || "A";
                    const numberText = keyParts.hasNumber ? String(keyParts.number).padStart(Math.max(String(Math.trunc(keyParts.number)).length, 3), "0") : "001";
                    return `
                      <label class="admin-project-key-order-input">
                        <span>Category Key</span>
                        <div class="admin-project-key-order-field">
                          <span class="admin-project-key-order-prefix">${prefix}</span>
                          <input
                            type="text"
                            value="${numberText.replace(/"/g, "&quot;")}"
                            data-order-input="project-category"
                            data-row-id="${project.id}"
                            data-key-prefix="${prefix}"
                            data-key-width="${Math.max(String(Math.trunc(keyParts.number || 0) || 0).length, 3)}"
                          >
                        </div>
                      </label>
                    `;
                  })()}
                </div>
              `).join("") : `<div class="admin-project-manager-empty">No projects in this category.</div>`}
            </div>
          </section>
        `;
      }).join("")}
    `;

    keyOrderSections.querySelectorAll("[data-key-order-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.closest("[data-key-order-section]");
        const content = section?.querySelector("[data-key-order-content]");
        const isOpen = section?.dataset.sectionOpen === "true";
        const nextOpen = !isOpen;

        if (section) {
          section.dataset.sectionOpen = nextOpen ? "true" : "false";
          section.classList.toggle("admin-project-key-order-section--open", nextOpen);
        }

        if (content) {
          content.hidden = !nextOpen;
        }

        button.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });
    });

    keyOrderSections.querySelectorAll('[data-order-input="project"], [data-order-input="project-category"]').forEach((input) => {
      bindDigitsOnlyInput(input, input.value || "001");
    });
  }
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
