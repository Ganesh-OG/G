import { getTable } from "./db.js";
import { getStorage } from "./config.js";
import { createCircularSlider } from "./circular-slider.js";
import { openProjectPopup } from "./project-popup.js";

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

async function populateProjects() {

  try {

    const [rows, categoryRows] = await Promise.all([
      getTable("projects"),
      getTable("project_category")
    ]);

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

    const categories = sortCategoriesByKey(categoryRows)
      .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
      .map((row) => ({
        value: row.category,
        label: row.label || row.category
      }));

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

    sortProjectsByPriority(rows.filter((project) => project.name), categoryRows, ALL_CATEGORY).forEach(project => {

      if (!project.name) return;

      const formattedCategory = project.category || "other";

      const projectItem = document.createElement('li');
      projectItem.className = 'project-item';
      projectItem.setAttribute('project-filter-item', '');
      projectItem.setAttribute('data-category', formattedCategory);
      projectItem.setAttribute('data-row-id', project.id);

      // ✅ NEW DATA ATTRIBUTES
      projectItem.dataset.action = normalizeProjectAction(project);
      projectItem.dataset.key = project.project_key;
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

      const cardBodyHTML = `
        <figure class="project-img">
          ${imgElement.outerHTML}
        </figure>

        <h3 class="project-title">
          ${titleText}
        </h3>
      `;

      const projectAction = normalizeProjectAction(project);
      const isRedirectProject = projectAction === "redirect" && project.link;
      const contentHTML = isRedirectProject
        ? `
          <a href="${project.link}" target="_blank" rel="noopener noreferrer">
            ${cardBodyHTML}
          </a>
        `
        : cardBodyHTML;

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

    attachEventListeners(newContent, slider, rows, categoryRows);

  }

  catch (error) {
    console.error("Error fetching projects:", error);
  }

}

// =============================
// EVENTS + FILTER + CLICK
// =============================
function attachEventListeners(container, slider, rows, categoryRows) {

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
      ? sortProjectsByPriority(rows.filter((project) => project.name), categoryRows, ALL_CATEGORY)
      : sortProjectsByPriority(
          rows.filter((project) => project.name && normalizeCategory(project.category) === normalizeCategory(selectedValue)),
          categoryRows,
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
  // CLICK HANDLER (POPUP / REDIRECT)
  // =============================
  projectFilterItems.forEach(item => {

    item.addEventListener("click", async function () {

      const action = this.dataset.action;
      const key = this.dataset.key;
      const fileName = this.dataset.fileName;
      const url = this.dataset.url;

      if (action === "file") {
        try {
          await openProjectPopup({
            title: this.querySelector(".project-title")?.textContent?.trim(),
            fileName
          });
        } catch (err) {
          console.error(err);
        }
        return;
      }

      if (action === "redirect" && url) {
        window.open(url, "_blank");
        return;
      }

      if (action === "popup" && key) {
        try {
          const { data, error } = await window.supabase
            .from("project_details")
            .select("content")
            .eq("project_key", key)
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

populateProjects();
