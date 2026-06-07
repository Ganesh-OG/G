import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG, getStorage } from "./config.js";
import { addEditButton, openEditor } from "./editor-tools.js";
import { createCircularSlider } from "../../components/circular-slider.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

const ALL_CATEGORY = "all";

let certificationRows = [];
let certificationCategoryRows = [];

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

function normalizeKeyLetters(value = "", fallback = "P") {
  const lettersOnly = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const fallbackLetters = String(fallback || "P")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return lettersOnly || fallbackLetters || "P";
}

function normalizeKeyDigits(value = "", fallback = "001") {
  const digitsOnly = String(value || "").replace(/\D/g, "");
  const fallbackDigits = String(fallback || "001").replace(/\D/g, "");
  return digitsOnly || fallbackDigits || "001";
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

function getCertificationSortKey(row = {}) {
  return String(
    row?.category_key ||
    row?.Category_Key_letter ||
    row?.label ||
    getCertificationCategoryValue(row) ||
    ""
  ).trim().toUpperCase();
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

    const keyComparison = compareOrderKeys(getCertificationSortKey(a), getCertificationSortKey(b));
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

function getCertificationCategoryPriority(categoryRows, category) {
  const row = categoryRows.find((item) => normalizeCategory(item.category) === normalizeCategory(category));
  return parsePriorityArray(row?.priority);
}

function sortCertificationsByPriority(rows, categoryRows, category, orderField = "all_Key") {
  const priorityIds = getCertificationCategoryPriority(categoryRows, category);
  const priorityIndex = new Map(priorityIds.map((id, index) => [Number(id), index]));

  return [...rows].sort((a, b) => {
    const leftKey = orderField === "category_key"
      ? getCertificationCategoryKey(a)
      : getCertificationAllKey(a);
    const rightKey = orderField === "category_key"
      ? getCertificationCategoryKey(b)
      : getCertificationAllKey(b);
    const keyComparison = compareOrderKeys(leftKey, rightKey);
    if (keyComparison !== 0) return keyComparison;

    const aPriority = priorityIndex.has(Number(a?.id));
    const bPriority = priorityIndex.has(Number(b?.id));

    if (aPriority && bPriority) {
      return priorityIndex.get(Number(a.id)) - priorityIndex.get(Number(b.id));
    }

    if (aPriority !== bPriority) {
      return aPriority ? -1 : 1;
    }

    return String(a?.title || a?.name || "").localeCompare(String(b?.title || b?.name || ""), undefined, { sensitivity: "base" });
  });
}

function ensureCertificationCategoryLetter(categoryName = "", existingLetter = "") {
  const normalizedExisting = normalizeKeyLetters(existingLetter, "");
  if (normalizedExisting) return normalizedExisting;

  const letters = String(categoryName || "")
    .trim()
    .split(/[\s,.-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return letters || "P";
}

function getCertificationCategoryOptions() {
  return sortCategoriesByKey(certificationCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category
    }));
}

async function ensureCertificationCategoryExists(category) {
  if (!category) return;
  const exists = certificationCategoryRows.some((row) => row.category === category);
  if (exists) return;

  await fetch(`${DB_BASE}/certificate_category`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      category,
      label: category,
      Category_Key_letter: ensureCertificationCategoryLetter(category)
    })
  });
}

function getAllCertificationKeyPrefix() {
  const orderedCertifications = sortCertificationsByPriority(
    certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title),
    certificationCategoryRows,
    ALL_CATEGORY,
    "all_Key"
  );
  const firstKey = getCertificationAllKey(orderedCertifications[0]);
  const parts = getOrderKeyParts(firstKey);
  return (parts.prefix || "P").toUpperCase();
}

function getNextOrderKey(rows, fieldName, prefix, fallbackWidth = 3) {
  const normalizedPrefix = String(prefix || "").trim().toLowerCase() || "p";
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

function ensureCertificationKey(existingKey = "", rows = certificationRows) {
  const normalizedExisting = String(existingKey || "").trim();
  if (normalizedExisting) return normalizedExisting;
  return getNextOrderKey(rows.map((row) => ({ ...row, all_Key: getCertificationAllKey(row) })), "all_Key", getAllCertificationKeyPrefix());
}

function ensureCertificationCategoryKey(categoryName = "", existingKey = "", rows = certificationRows) {
  const normalizedExisting = String(existingKey || "").trim();
  if (normalizedExisting) return normalizedExisting;
  const categoryLetter = getCertificationCategoryLetter(categoryName) || ensureCertificationCategoryLetter(categoryName);
  const scopedRows = rows.filter((row) => normalizeCategory(getCertificationCategoryValue(row)) === normalizeCategory(categoryName));
  return getNextOrderKey(scopedRows.map((row) => ({ ...row, category_key: getCertificationCategoryKey(row) })), "category_key", categoryLetter);
}

function getCertificationCategoryLetter(categoryName = "") {
  const row = certificationCategoryRows.find((item) => normalizeCategory(item.category) === normalizeCategory(categoryName));
  return String(row?.Category_Key_letter || row?.category_key || "").trim().toUpperCase();
}

function normalizeCertificationFields(payload, currentCategory = "") {
  const category = payload.category_select?.trim() || payload.category?.trim() || payload.provider?.trim() || currentCategory || "";
  const provider = payload.provider?.trim() || category || null;

  return {
    category,
    provider,
    title: payload.title?.trim() || null,
    completion_date: payload.completion_date || null,
    message: payload.message?.trim() || null,
    file_name: payload.file_name?.trim() || null,
    cert_link: payload.cert_link?.trim() || null,
    all_Key: ensureCertificationKey(payload.all_Key),
    category_key: ensureCertificationCategoryKey(category, payload.category_key)
  };
}

function bindLettersOnlyInput(input, fallbackValue = "P") {
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

function getCertificationCategories() {
  return getCertificationCategoryOptions().map((item) => item.value);
}

function buildCertificationPriorityGroups(category) {
  const normalized = normalizeCategory(category);
  const rows = certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title);

  if (!normalized || normalized === ALL_CATEGORY) {
    return certificationCategoryRows
      .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
      .map((row) => ({
        title: row.label || row.category,
        items: sortCertificationsByPriority(
          rows.filter((item) => normalizeCategory(getCertificationCategoryValue(item)) === normalizeCategory(row.category)),
          certificationCategoryRows,
          row.category,
          "category_key"
        )
      }))
      .filter((group) => group.items.length);
  }

  return [{
    title: category,
    items: sortCertificationsByPriority(
      rows.filter((item) => normalizeCategory(getCertificationCategoryValue(item)) === normalized),
      certificationCategoryRows,
      category,
      "category_key"
    )
  }];
}

function openCertificationEditor(cert, forcedCategory = "") {
  const categories = getCertificationCategories();
  const initialCategory = forcedCategory || getCertificationCategoryValue(cert) || categories[0] || "";
  const initialAllKey = ensureCertificationKey(cert?.all_Key || cert?.all_key);
  const initialCategoryKey = ensureCertificationCategoryKey(initialCategory, cert?.category_key);

  openEditor({
    table: "certifications",
    row: cert,
    method: cert?.id ? "PATCH" : "POST",
    title: cert?.id ? (cert.title || "Edit Certification") : "Add Certification",
    fields: [
      {
        name: "category_select",
        label: "Category",
        type: "select",
        value: initialCategory,
        options: getCertificationCategoryOptions()
      },
      {
        name: "all_Key",
        label: "All Key",
        value: initialAllKey,
        placeholder: "P001, P002, P003...",
        helpText: "This controls the order in the full certifications list. We auto-fill the next available key when blank."
      },
      {
        name: "category_key",
        label: "Category Key",
        value: initialCategoryKey,
        placeholder: "G001, G002, G003...",
        helpText: "This controls the order inside the selected category. We auto-fill from the category's key prefix."
      },
      { name: "title", value: cert?.title || "" },
      { name: "provider", value: cert?.provider || initialCategory || "" },
      { name: "completion_date", value: cert?.completion_date || "" },
      { name: "message", value: cert?.message || "", type: "textarea" },
      { name: "file_name", value: cert?.file_name || "", type: "image", storageFolder: "Certifications" },
      { name: "cert_link", value: cert?.cert_link || "", type: "url" }
    ],
    onOpen: ({ form }) => {
      const categorySelect = form.querySelector('[name="category_select"]');
      const allKeyInput = form.querySelector('[name="all_Key"]');
      const categoryKeyInput = form.querySelector('[name="category_key"]');

      const syncCertificationKeys = () => {
        if (allKeyInput) {
          const isAllKeyAuto = allKeyInput.dataset.autofilled !== "false";
          if (!String(allKeyInput.value || "").trim() || isAllKeyAuto) {
            allKeyInput.value = ensureCertificationKey("");
            allKeyInput.dataset.autofilled = "true";
          }
        }

        if (categoryKeyInput) {
          const isCategoryKeyAuto = categoryKeyInput.dataset.autofilled !== "false";
          if (!String(categoryKeyInput.value || "").trim() || isCategoryKeyAuto) {
            categoryKeyInput.value = ensureCertificationCategoryKey(categorySelect?.value || initialCategory, "");
            categoryKeyInput.dataset.autofilled = "true";
          }
        }
      };

      categorySelect?.addEventListener("change", () => {
        syncCertificationKeys();
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

      syncCertificationKeys();
    },
    onBack: openCertificationsManager,
    transformPayload: ({ payload }) => normalizeCertificationFields(payload, initialCategory),
    submitHandler: async ({ table, rowId, method, payload, headers, dbBase }) => {
      await ensureCertificationCategoryExists(payload.category);
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

function openAddCertificationEditor() {
  openCertificationEditor(null);
}

function openEditCertificationEditor(cert) {
  openCertificationEditor(cert);
}

function openCertificationEditorFromManager(cert = null) {
  openCertificationEditor(cert);
  window.setTimeout(() => {
    closeCertificationsManager();
  }, 0);
}

function openEditAllKeysEditor() {
  const initialAllKeyPrefix = getAllCertificationKeyPrefix();

  openEditor({
    table: "certifications",
    title: "Edit All Certification Keys",
    method: "POST",
    refreshMode: "close",
    fields: [
      { name: "current_all_key_prefix", label: "Current All Key Prefix", value: initialAllKeyPrefix },
      {
        name: "new_all_key_prefix",
        label: "New All Key Prefix",
        value: initialAllKeyPrefix,
        placeholder: "P",
        helpText: "This updates every certification's All Key and keeps the numeric order."
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
      const currentPrefix = normalizeKeyLetters(payload.current_all_key_prefix, initialAllKeyPrefix);
      const nextPrefix = normalizeKeyLetters(payload.new_all_key_prefix, initialAllKeyPrefix);

      if (currentPrefix === nextPrefix) {
        return new Response(JSON.stringify({ ok: true, unchanged: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const orderedCertifications = sortCertificationsByPriority(
        certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title),
        certificationCategoryRows,
        ALL_CATEGORY,
        "all_Key"
      );

      const updates = orderedCertifications.map((cert, index) => {
      const currentKey = getCertificationAllKey(cert);
        const keyParts = getOrderKeyParts(currentKey);
        const numericPart = keyParts.hasNumber ? keyParts.number : (index + 1);
        const width = keyParts.hasNumber ? Math.max(String(Math.trunc(keyParts.number)).length, 3) : 3;

        return fetch(`${DB_BASE}/certifications?id=eq.${encodeURIComponent(cert.id)}`, {
          method: "PATCH",
          headers: {
            ...HEADERS,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            all_Key: formatOrderKey(nextPrefix, numericPart, width)
          })
        });
      });

      const results = await Promise.all(updates);
      const failed = results.find((response) => response && response.ok === false);

      if (failed) {
        const errorText = await failed.text();
        throw new Error(errorText || "Failed to update certification All keys.");
      }

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

function openRenameCategoryEditor(category) {
  const categoryRow = certificationCategoryRows.find((row) => row.category === category);
  const initialCategoryKey = ensureCertificationCategoryLetter(category, categoryRow?.Category_Key_letter);

  openEditor({
    table: "certificate_category",
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
        placeholder: "A, GL, GC...",
        helpText: "This is the category prefix used for category ordering and certification key grouping."
      }
    ],
    onOpen: ({ form }) => {
      const newInput = form.querySelector('[name="new_category"]');
      const keyInput = form.querySelector('[name="Category_Key_letter"]');
      const syncKey = () => {
        if (keyInput && !String(keyInput.value || "").trim()) {
          keyInput.value = ensureCertificationCategoryLetter(newInput?.value || category, keyInput.value);
        }
      };

      newInput?.addEventListener("input", syncKey);
      bindLettersOnlyInput(keyInput, ensureCertificationCategoryLetter(category, ""));
      syncKey();
    },
    transformPayload: ({ payload }) => ({
      old_category: payload.old_category?.trim(),
      new_category: payload.new_category?.trim(),
      Category_Key_letter: normalizeKeyLetters(payload.Category_Key_letter, ensureCertificationCategoryLetter(payload.new_category, ""))
    }),
    onBack: openCertificationsManager,
    submitHandler: async ({ payload }) => {
      const categoryResponse = await fetch(`${DB_BASE}/certificate_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
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

      await fetch(`${DB_BASE}/certifications?category=eq.${encodeURIComponent(payload.old_category)}`, {
        method: "PATCH",
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          category: payload.new_category,
          provider: payload.new_category
        })
      });

      await updateCertificationCategoryKeysForCategory(
        payload.old_category,
        payload.new_category,
        payload.Category_Key_letter
      );

      return categoryResponse;
    }
  });
}

function openAddCategoryFlow() {
  openEditor({
    table: "certificate_category",
    title: "Add New Category",
    method: "POST",
    fields: [
      { name: "new_category", label: "Category Name", value: "" },
      {
        name: "Category_Key_letter",
        label: "Category Key Letter",
        value: "",
        placeholder: "A, GL, GC...",
        helpText: "This is the category prefix used for category ordering and certification key grouping."
      }
    ],
    onOpen: ({ form }) => {
      const categoryInput = form.querySelector('[name="new_category"]');
      const keyInput = form.querySelector('[name="Category_Key_letter"]');
      const syncKey = () => {
        if (keyInput && !String(keyInput.value || "").trim()) {
          keyInput.value = ensureCertificationCategoryLetter(categoryInput?.value, keyInput.value);
        }
      };

      categoryInput?.addEventListener("input", syncKey);
      bindLettersOnlyInput(keyInput, "");
      syncKey();
    },
    transformPayload: ({ payload }) => ({
      new_category: payload.new_category?.trim(),
      Category_Key_letter: normalizeKeyLetters(payload.Category_Key_letter, ensureCertificationCategoryLetter(payload.new_category, ""))
    }),
    onBack: openCertificationsManager,
    submitHandler: async ({ payload }) => {
      const categoryName = payload.new_category?.trim();

      if (!categoryName) {
        return new Response("Category name is required.", {
          status: 400,
          headers: { "Content-Type": "text/plain" }
        });
      }

      return fetch(`${DB_BASE}/certificate_category`, {
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

async function updateCertificationCategoryKeysForCategory(oldCategory, newCategory, newCategoryLetter) {
  const scopedCertifications = certificationRows.filter(
    (cert) => getCertificationCategoryValue(cert) && normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(oldCategory)
  );

  if (!scopedCertifications.length) return;

  const orderedCertifications = sortCertificationsByPriority(scopedCertifications, certificationCategoryRows, oldCategory, "category_key");
  const updates = orderedCertifications.map((cert, index) => {
    const keyParts = getOrderKeyParts(cert.category_key);
    const numericPart = keyParts.hasNumber ? keyParts.number : (index + 1);
    const width = keyParts.hasNumber ? Math.max(String(Math.trunc(keyParts.number)).length, 3) : 3;

    return fetch(`${DB_BASE}/certifications?id=eq.${encodeURIComponent(cert.id)}`, {
      method: "PATCH",
      headers: {
        ...HEADERS,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        category: newCategory,
        provider: newCategory,
        category_key: formatOrderKey(newCategoryLetter, numericPart, width)
      })
    });
  });

  await Promise.all(updates);
}

async function deleteCertificationCategory(category) {
  const categoryRow = certificationCategoryRows.find((row) => row.category === category);
  const confirmed = window.confirm(`Delete category "${category}" and all certifications inside it?`);
  if (!confirmed || !categoryRow) return;

  try {
    const certificationsResponse = await fetch(`${DB_BASE}/certifications?category=eq.${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!certificationsResponse.ok) {
      throw new Error(await certificationsResponse.text());
    }

    const categoryResponse = await fetch(`${DB_BASE}/certificate_category?id=eq.${encodeURIComponent(categoryRow.id)}`, {
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

async function saveCertificationKeyOrder(modal) {
  const categoryInputs = Array.from(modal?.querySelectorAll('[data-order-input="certification-category"]') || []);
  const certificationInputs = Array.from(modal?.querySelectorAll('[data-order-input="certification"]') || []);
  const updates = [];

  categoryInputs.forEach((input) => {
    const rowId = input.dataset.rowId;
    const row = certificationRows.find((item) => String(item.id) === String(rowId));
    if (!row) return;

    const currentKey = getCertificationCategoryKey(row);
    const currentParts = getOrderKeyParts(currentKey);
    const prefix = String(input.dataset.keyPrefix || currentParts.prefix || "").trim().toUpperCase();
    const width = Number(input.dataset.keyWidth || Math.max(String(Math.trunc(currentParts.number || 0) || 0).length, 3)) || 3;
    const nextKey = formatOrderKey(prefix || currentParts.prefix || "P", normalizeKeyDigits(input.value, currentParts.hasNumber ? String(currentParts.number).padStart(width, "0") : "001"), width);

    if (nextKey !== currentKey) {
      updates.push(fetch(`${DB_BASE}/certifications?id=eq.${encodeURIComponent(row.id)}`, {
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

  certificationInputs.forEach((input) => {
    const rowId = input.dataset.rowId;
    const row = certificationRows.find((item) => String(item.id) === String(rowId));
    if (!row) return;

    const currentKey = getCertificationAllKey(row);
    const currentParts = getOrderKeyParts(currentKey);
    const prefix = String(input.dataset.keyPrefix || currentParts.prefix || "").trim().toUpperCase();
    const width = Number(input.dataset.keyWidth || Math.max(String(Math.trunc(currentParts.number || 0) || 0).length, 3)) || 3;
    const nextKey = formatOrderKey(prefix || currentParts.prefix || "P", normalizeKeyDigits(input.value, currentParts.hasNumber ? String(currentParts.number).padStart(width, "0") : "001"), width);

    if (nextKey !== currentKey) {
      updates.push(fetch(`${DB_BASE}/certifications?id=eq.${encodeURIComponent(row.id)}`, {
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
    window.alert(`Failed to save certification key order.\n${errorText}`);
    return;
  }

  window.location.reload();
}

function ensureCertificationsManagerModal() {
  if (document.getElementById("admin-certifications-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-certifications-manager";
  modal.className = "admin-project-manager";
  modal.innerHTML = `
    <div class="admin-project-manager-backdrop" data-close-certifications-manager></div>
    <section class="admin-project-manager-panel">
      <div class="admin-project-manager-header">
        <div>
          <p class="admin-project-manager-kicker">Certifications</p>
          <h3>Manage Certifications</h3>
        </div>
        <button type="button" class="admin-project-manager-close" data-close-certifications-manager aria-label="Close certifications manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-project-manager-toolbar">
        <button type="button" class="admin-project-manager-btn" data-edit-certification-prefix>Edit All Keys</button>
        <button type="button" class="admin-project-manager-btn" data-add-category>Add Category</button>
        <button type="button" class="admin-project-manager-btn" data-add-certification>Add Certification</button>
      </div>
      <div class="admin-project-key-order">
        <div class="admin-project-key-order-header">
          <div>
            <h4 class="admin-project-manager-subtitle">Key Order</h4>
            <p>Category keys control category/filter order. All keys control the global certification order.</p>
          </div>
          <button type="button" class="admin-project-manager-btn admin-project-key-order-save" data-save-certification-key-order>Save Order</button>
        </div>
        <div class="admin-project-key-order-sections" data-cert-key-order-sections></div>
      </div>
      <div class="admin-project-manager-sections">
        <div>
          <h4 class="admin-project-manager-subtitle">Categories</h4>
          <div class="admin-project-category-list"></div>
        </div>
        <div>
          <h4 class="admin-project-manager-subtitle">Certifications</h4>
          <div class="admin-project-list-manager"></div>
        </div>
      </div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-certifications-manager]")) {
      closeCertificationsManager();
    }
  });

  modal.querySelector("[data-add-certification]").addEventListener("click", () => {
    openCertificationEditorFromManager(null);
  });

  modal.querySelector("[data-edit-certification-prefix]").addEventListener("click", () => {
    closeCertificationsManager();
    openEditAllKeysEditor();
  });

  modal.querySelector("[data-add-category]").addEventListener("click", () => {
    closeCertificationsManager();
    window.setTimeout(() => {
      openAddCategoryFlow();
    }, 0);
  });

  modal.querySelector("[data-save-certification-key-order]")?.addEventListener("click", async () => {
    await saveCertificationKeyOrder(modal);
  });
}

function renderCertificationsManager() {
  const modal = document.getElementById("admin-certifications-manager");
  const categoryList = modal?.querySelector(".admin-project-category-list");
  const certificationList = modal?.querySelector(".admin-project-list-manager");
  const keyOrderSections = modal?.querySelector("[data-cert-key-order-sections]");

  if (!modal || !categoryList || !certificationList) return;

  const allCertificationsCount = certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title).length;
  const categories = sortCategoriesByKey(certificationCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category
    }));

  categoryList.innerHTML = `
    <div class="admin-project-category-card admin-project-category-card--all">
      <div>
        <strong>All</strong>
        <span>${allCertificationsCount} certification${allCertificationsCount === 1 ? "" : "s"}</span>
        <span>All Key order is managed here.</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-all-keys">Edit All</button>
      </div>
    </div>
    ${categories.length ? "" : `<div class="admin-project-manager-empty">No categories yet. Add one to create your first certification category.</div>`}
  `;

  categories.forEach(({ value, label }) => {
    const count = certificationRows.filter((cert) => normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(value)).length;
    const categoryRow = certificationCategoryRows.find((row) => row.category === value);
    const card = document.createElement("div");
    card.className = "admin-project-category-card";
    card.innerHTML = `
      <div>
        <strong>${label}</strong>
        <span>${count} certification${count === 1 ? "" : "s"}</span>
        <span>Category Key Letter: ${categoryRow?.Category_Key_letter || "None"}</span>
      </div>
      <div class="admin-project-card-actions">
        <button type="button" class="admin-project-manager-btn" data-action="edit-category">Edit Category</button>
        <button type="button" class="admin-project-manager-btn danger" data-action="delete-category">Delete Category</button>
      </div>
    `;

    card.querySelector('[data-action="edit-category"]').addEventListener("click", () => {
      closeCertificationsManager();
      openRenameCategoryEditor(value);
    });

    card.querySelector('[data-action="delete-category"]').addEventListener("click", () => {
      closeCertificationsManager();
      deleteCertificationCategory(value);
    });

    categoryList.appendChild(card);
  });

  categoryList.querySelector('[data-action="edit-all-keys"]')?.addEventListener("click", () => {
    closeCertificationsManager();
    openEditAllKeysEditor();
  });

  const groupedCategories = sortCategoriesByKey(certificationCategoryRows)
    .filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY)
    .map((row) => ({
      value: row.category,
      label: row.label || row.category,
      certifications: sortCertificationsByPriority(
        certificationRows.filter((cert) => normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(row.category)),
        certificationCategoryRows,
        row.category,
        "category_key"
      )
    }))
    .filter((group) => group.certifications.length);

  const uncategorizedCertifications = sortCertificationsByPriority(
    certificationRows.filter((cert) => !String(getCertificationCategoryValue(cert) || "").trim()),
    certificationCategoryRows,
    ALL_CATEGORY,
    "all_Key"
  );

  const certificationGroups = [
    ...groupedCategories,
    ...(uncategorizedCertifications.length ? [{
      value: "uncategorized",
      label: "Uncategorized",
      certifications: uncategorizedCertifications
    }] : [])
  ];

  certificationList.innerHTML = certificationGroups.length
    ? ""
    : `<div class="admin-project-manager-empty">No certifications yet. Add a certification to get started.</div>`;

  certificationGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "admin-project-group-section";
    section.dataset.projectGroupSection = "true";
    section.dataset.sectionOpen = "false";
    section.innerHTML = `
      <div class="admin-project-group-section-header">
        <button type="button" class="admin-project-group-toggle" data-project-group-toggle aria-expanded="false">
          <strong>${group.label}</strong>
          <span>${group.certifications.length} certification${group.certifications.length === 1 ? "" : "s"}</span>
          <ion-icon name="chevron-down-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-project-group-list" data-project-group-content hidden></div>
    `;

    const list = section.querySelector("[data-project-group-content]");
    group.certifications.forEach((cert) => {
      const card = document.createElement("div");
      card.className = "admin-project-card";
      card.innerHTML = `
        <div class="admin-project-card-main">
          <strong>${cert.title || "Untitled Certification"}</strong>
          <span>${getCertificationCategoryValue(cert) || "Uncategorized"}${cert.completion_date ? ` • ${cert.completion_date}` : ""}</span>
          <span>All Key: ${cert.all_Key || cert.all_key || cert.Priority_key || "None"}</span>
        </div>
        <div class="admin-project-card-actions">
          <button type="button" class="admin-project-manager-btn" data-action="edit">Edit Certification</button>
          <button type="button" class="admin-project-manager-btn danger" data-action="delete">Delete</button>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener("click", () => {
        openCertificationEditorFromManager(cert);
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", () => {
        closeCertificationsManager();
        deleteCertification(cert);
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

    certificationList.appendChild(section);
  });

  if (keyOrderSections) {
    const orderedAllCertifications = sortCertificationsByPriority(
      certificationRows.filter((cert) => getCertificationCategoryValue(cert) || cert.title),
      certificationCategoryRows,
      ALL_CATEGORY,
      "all_Key"
    );
    const orderedCategories = sortCategoriesByKey(certificationCategoryRows).filter((row) => row.category && normalizeCategory(row.category) !== ALL_CATEGORY);
    keyOrderSections.innerHTML = `
      <section class="admin-project-key-order-section" data-key-order-section data-section-open="false">
        <div class="admin-project-key-order-section-header">
          <button type="button" class="admin-project-key-order-toggle" data-key-order-toggle aria-expanded="false">
            <strong>All</strong>
            <ion-icon name="chevron-down-outline"></ion-icon>
          </button>
        </div>
        <div class="admin-project-key-order-list" data-key-order-content hidden>
          ${orderedAllCertifications.length ? orderedAllCertifications.map((cert) => `
            <div class="admin-project-key-order-card">
              <div class="admin-project-key-order-card-main">
                <strong>${cert.title || "Untitled Certification"}</strong>
                <span>${getCertificationCategoryValue(cert) || "Uncategorized"}${cert.completion_date ? ` • ${cert.completion_date}` : ""}</span>
              </div>
              ${(() => {
                const keyParts = getOrderKeyParts(cert.all_Key || cert.all_key || cert.Priority_key || "P001");
                const prefix = keyParts.prefix.toUpperCase() || "P";
                const numberText = keyParts.hasNumber ? String(keyParts.number).padStart(Math.max(String(Math.trunc(keyParts.number)).length, 3), "0") : "001";
                return `
                  <label class="admin-project-key-order-input">
                    <span>All Key</span>
                    <div class="admin-project-key-order-field">
                      <span class="admin-project-key-order-prefix">${prefix}</span>
                      <input
                        type="text"
                        value="${numberText.replace(/"/g, "&quot;")}"
                        data-order-input="certification"
                        data-row-id="${cert.id}"
                        data-key-prefix="${prefix}"
                        data-key-width="${Math.max(String(Math.trunc(keyParts.number || 0) || 0).length, 3)}"
                      >
                    </div>
                  </label>
                `;
              })()}
            </div>
          `).join("") : `<div class="admin-project-manager-empty">No certifications yet.</div>`}
        </div>
      </section>
      ${orderedCategories.map((categoryRow) => {
        const certificationsInCategory = sortCertificationsByPriority(
          certificationRows.filter((cert) => normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(categoryRow.category)),
          certificationCategoryRows,
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
              ${certificationsInCategory.length ? certificationsInCategory.map((cert) => `
                <div class="admin-project-key-order-card">
                  <div class="admin-project-key-order-card-main">
                    <strong>${cert.title || "Untitled Certification"}</strong>
                    <span>${getCertificationCategoryValue(cert) || "Uncategorized"}${cert.completion_date ? ` • ${cert.completion_date}` : ""}</span>
                  </div>
                  ${(() => {
                    const keyParts = getOrderKeyParts(cert.category_key || "P001");
                    const prefix = keyParts.prefix.toUpperCase() || "P";
                    const numberText = keyParts.hasNumber ? String(keyParts.number).padStart(Math.max(String(Math.trunc(keyParts.number)).length, 3), "0") : "001";
                    return `
                      <label class="admin-project-key-order-input">
                        <span>Category Key</span>
                        <div class="admin-project-key-order-field">
                          <span class="admin-project-key-order-prefix">${prefix}</span>
                          <input
                            type="text"
                            value="${numberText.replace(/"/g, "&quot;")}"
                            data-order-input="certification-category"
                            data-row-id="${cert.id}"
                            data-key-prefix="${prefix}"
                            data-key-width="${Math.max(String(Math.trunc(keyParts.number || 0) || 0).length, 3)}"
                          >
                        </div>
                      </label>
                    `;
                  })()}
                </div>
              `).join("") : `<div class="admin-project-manager-empty">No certifications in this category.</div>`}
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

    keyOrderSections.querySelectorAll('[data-order-input="certification"], [data-order-input="certification-category"]').forEach((input) => {
      bindDigitsOnlyInput(input, input.value || "001");
    });
  }
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

async function fetchAndUpdateCertifications() {
  try {
    const [rows, categoryRows] = await Promise.all([
      getTable("certifications"),
      getTable("certificate_category")
    ]);

    certificationRows = rows;
    certificationCategoryRows = categoryRows;

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
    const categoryOptions = getCertificationCategoryOptions();
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

    sortCertificationsByPriority(rows.filter((cert) => getCertificationCategoryValue(cert) || cert.title), certificationCategoryRows, ALL_CATEGORY, "all_Key").forEach((cert) => {
      const imageURL = getStorage("Certifications", cert.file_name) || fallbackImageUrl;
      const categoryValue = getCertificationCategoryValue(cert);

      const li = document.createElement("li");
      li.className = "blog-post-item";
      li.setAttribute("project-filter-item", "");
      li.setAttribute("data-category", categoryValue || "uncategorized");
      li.setAttribute("data-row-id", cert.id);
      li.dataset.key = getCertificationAllKey(cert);

      li.innerHTML = `
        <a href="${cert.cert_link}" target="_blank" rel="noopener">
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

      addEditButton(li, {
        table: "certifications",
        row: cert,
        title: cert.title || "Certification",
        fields: [
          {
            name: "category_select",
            label: "Category",
            type: "select",
            value: categoryValue || "",
            options: getCertificationCategoryOptions()
          },
          { name: "all_Key", label: "All Key", value: getCertificationAllKey(cert), helpText: "This controls the order in the full certifications list." },
          { name: "category_key", label: "Category Key", value: getCertificationCategoryKey(cert), helpText: "This controls the order inside the selected category." },
          { name: "title", value: cert.title },
          { name: "provider", value: cert.provider },
          { name: "completion_date", value: cert.completion_date, type: "date" },
          { name: "message", value: cert.message, type: "textarea" },
          { name: "file_name", value: cert.file_name, type: "image", storageFolder: "Certifications" },
          { name: "cert_link", value: cert.cert_link, type: "url" }
        ],
        onOpen: ({ form }) => {
          const categorySelect = form.querySelector('[name="category_select"]');
          const allKeyInput = form.querySelector('[name="all_Key"]');
          const categoryKeyInput = form.querySelector('[name="category_key"]');

          const syncCertificationKeys = () => {
            if (allKeyInput) {
              const isAllKeyAuto = allKeyInput.dataset.autofilled !== "false";
              if (!String(allKeyInput.value || "").trim() || isAllKeyAuto) {
                allKeyInput.value = ensureCertificationKey("");
                allKeyInput.dataset.autofilled = "true";
              }
            }

            if (categoryKeyInput) {
              const isCategoryKeyAuto = categoryKeyInput.dataset.autofilled !== "false";
              if (!String(categoryKeyInput.value || "").trim() || isCategoryKeyAuto) {
                categoryKeyInput.value = ensureCertificationCategoryKey(categorySelect?.value || categoryValue || "", "");
                categoryKeyInput.dataset.autofilled = "true";
              }
            }
          };

          categorySelect?.addEventListener("change", syncCertificationKeys);

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

          syncCertificationKeys();
        },
        transformPayload: ({ payload }) => normalizeCertificationFields(payload, categoryValue)
      });

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

    attachEventListeners(newContent, slider);
    ensureCertificationsManagerModal();

  } catch (error) {
    console.error("Error fetching certifications:", error);
  }
}

function attachEventListeners(container, slider) {
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
          certificationRows.filter((cert) => getCertificationCategoryValue(cert) && normalizeCategory(getCertificationCategoryValue(cert)) === normalizeCategory(selectedValue)),
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
