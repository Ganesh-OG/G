import { getTable } from "./db.js";
import { getStorage } from "./config.js";
import { createCircularSlider } from "./circular-slider.js";

const ALL_CATEGORY = "all";

function normalizeCategory(category) {
  return String(category || "").trim().toLowerCase();
}

function getCertificationCategoryValue(row = {}) {
  return String(row?.category || row?.provider || "").trim();
}

function getCertificationAllKey(row = {}) {
  return String(row?.all_Key || row?.all_key || row?.Priority_key || "").trim();
}

function getCertificationCategoryKey(row = {}) {
  return String(row?.category_key || row?.categoryKey || "").trim();
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

function sortCategoriesByKey(rows) {
  return [...rows].sort((a, b) => {
    const aKey = String(a?.category_key || a?.Category_Key_letter || a?.label || a?.category || "").trim().toUpperCase();
    const bKey = String(b?.category_key || b?.Category_Key_letter || b?.label || b?.category || "").trim().toUpperCase();

    const aPriority = Number(a?.Priority_key ?? a?.priority_key);
    const bPriority = Number(b?.Priority_key ?? b?.priority_key);

    if (Number.isFinite(aPriority) && Number.isFinite(bPriority) && aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    if (Number.isFinite(aPriority) !== Number.isFinite(bPriority)) {
      return Number.isFinite(aPriority) ? -1 : 1;
    }

    const keyComparison = compareOrderKeys(aKey, bKey);
    if (keyComparison !== 0) return keyComparison;

    return String(a?.label || a?.category || "").localeCompare(String(b?.label || b?.category || ""), undefined, { sensitivity: "base" });
  });
}

function sortCertificationsByPriority(rows, categoryRows, category, orderField = "all_Key") {
  return [...rows].sort((a, b) => {
    const leftKey = orderField === "category_key"
      ? getCertificationCategoryKey(a)
      : getCertificationAllKey(a);
    const rightKey = orderField === "category_key"
      ? getCertificationCategoryKey(b)
      : getCertificationAllKey(b);
    const keyComparison = compareOrderKeys(leftKey, rightKey);
    if (keyComparison !== 0) return keyComparison;

    return String(a?.title || a?.name || "").localeCompare(String(b?.title || b?.name || ""), undefined, { sensitivity: "base" });
  });
}

async function fetchAndUpdateCertifications() {
  try {
    const [rows, categoryRows] = await Promise.all([
      getTable("certifications"),
      getTable("certificate_category")
    ]);

    const article = document.querySelector('article.blog[data-page="blog"]');
    const header = article?.querySelector("header");

    if (!article || !header) {
      console.error("Certifications or DOM elements missing");
      return;
    }

    const existingList = article.querySelector(".blog-posts-list");
    existingList?.remove();

    const existingFilterSection = article.querySelector(".certification-filter-section");
    existingFilterSection?.remove();

    const newContent = document.createElement("section");
    newContent.className = "projects certification-filter-section";
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

      <ul class="blog-posts-list"></ul>
    `;

    article.insertBefore(newContent, header.nextSibling);

    const filterList = newContent.querySelector(".filter-list");
    const selectList = newContent.querySelector(".select-list");
    const certificationList = newContent.querySelector(".blog-posts-list");
    const certificationSelectValue = newContent.querySelector("[project-select-value]");
    const categoryOptions = sortCategoriesByKey(categoryRows)
      .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
      .map((row) => ({
        value: row.category,
        label: row.label || row.category
      }));
    const fallbackImageUrl = getStorage("Certifications", "404.gif");

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

    sortCertificationsByPriority(rows.filter((cert) => getCertificationCategoryValue(cert) || cert.title), categoryRows, ALL_CATEGORY, "all_Key").forEach((cert) => {
      const imageURL = getStorage("Certifications", cert.file_name) || fallbackImageUrl;
      const categoryValue = getCertificationCategoryValue(cert);

      const li = document.createElement("li");
      li.className = "blog-post-item";
      li.setAttribute("project-filter-item", "");
      li.setAttribute("data-category", categoryValue || "uncategorized");
      li.setAttribute("data-row-id", cert.id);
      li.dataset.key = getCertificationAllKey(cert);

      li.innerHTML = `
        <a href="${cert.cert_link}" target="_blank">
          <figure class="blog-banner-box">
            <img src="${imageURL}" alt="${cert.title}" loading="lazy">
          </figure>

          <div class="blog-content">
            <div class="blog-meta">
              <p class="blog-category">${categoryValue || "Uncategorized"}</p>
              <span class="dot"></span>
              <time datetime="${cert.completion_date}">
                ${cert.completion_date}
              </time>
            </div>

            <h3 class="h3 blog-item-title">${cert.title}</h3>

            <p class="blog-text">${cert.message}</p>
          </div>
        </a>
      `;

      certificationList.appendChild(li);
    });

    certificationList.querySelectorAll(".blog-post-item").forEach((item) => {
      item.setAttribute("data-slider-active", "true");
    });

    const slider = createCircularSlider(certificationList, {
      desktop: 2,
      mobile: 1,
      selector: ".blog-post-item"
    });

    attachEventListeners(newContent, rows, categoryRows, slider);

  } catch (error) {
    console.error("Error fetching certifications:", error);
  }
}

function attachEventListeners(container, certificationRows, certificationCategoryRows, slider) {
  const certificationSelect = container.querySelector("[project-select]");
  const certificationSelectItems = container.querySelectorAll("[project-select-item]");
  const certificationSelectValue = container.querySelector("[project-select-value]");
  const certificationFilterBtn = container.querySelectorAll("[project-filter-btn]");
  const certificationFilterItems = container.querySelectorAll("[project-filter-item]");
  const certificationList = container.querySelector(".blog-posts-list");

  const certificationFilterFunc = function (selectedValue) {
    certificationFilterItems.forEach((item) => {
      const isVisible = selectedValue === "all" || normalizeCategory(selectedValue) === normalizeCategory(item.dataset.category);
      item.setAttribute("data-slider-active", isVisible ? "true" : "false");
    });

    const sortedRows = selectedValue === ALL_CATEGORY
      ? sortCertificationsByPriority(certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title), certificationCategoryRows, ALL_CATEGORY, "all_Key")
      : sortCertificationsByPriority(
          certificationRows.filter((cert) => normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(selectedValue)),
          certificationCategoryRows,
          selectedValue,
          "category_key"
        );

    sortedRows.forEach((cert) => {
      const item = certificationList.querySelector(`[data-row-id="${cert.id}"]`);
      if (item) certificationList.appendChild(item);
    });

    slider?.refresh(true);
  };

  certificationFilterFunc("all");
  certificationSelectValue.innerText = "All";

  if (certificationSelect) {
    certificationSelect.addEventListener("click", function () {
      elementToggleFunc(this);
    });
  }

  certificationSelectItems.forEach((item) => {
    item.addEventListener("click", function () {
      const rawCategory = this.dataset.category || this.innerText.toLowerCase().replace(/ /g, "-");
      certificationSelectValue.innerText = this.innerText;

      if (certificationSelect) elementToggleFunc(certificationSelect);

      certificationFilterFunc(rawCategory);
    });
  });

  let lastTouchedButton = certificationFilterBtn[0];
  certificationFilterBtn.forEach((btn) => {
    btn.addEventListener("click", function () {
      const rawCategory = this.dataset.category || this.innerText.toLowerCase().replace(/ /g, "-");
      certificationSelectValue.innerText = this.innerText;
      certificationFilterFunc(rawCategory);

      if (lastTouchedButton) {
        lastTouchedButton.classList.remove("active");
      }

      this.classList.add("active");
      lastTouchedButton = this;
    });
  });

  window.addEventListener("resize", () => {
    certificationSelectValue.innerText = "All";
  });
}

document.addEventListener("DOMContentLoaded", fetchAndUpdateCertifications);
