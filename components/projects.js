import { getTable } from "./db.js";
import { getStorage } from "./config.js";

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

    const categories = categoryRows
      .filter((row) => row.category)
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

populateProjects();
