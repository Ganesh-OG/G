import { SUPABASE_CONFIG, DB_BASE, getStorage } from "./config.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

const DEFAULT_TEXTAREA_FIELDS = new Set([
  "content",
  "message",
  "description",
  "experience",
  "role",
  "specialisation",
  "working_at"
]);

const STORAGE_BUCKET = "portfolio";
let currentEditorConfig = null;
let editorBackHandler = null;

function ensureEditorMounted() {
  if (document.getElementById("admin-editor-modal")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="admin-editor-modal" id="admin-editor-modal" aria-hidden="true">
      <div class="admin-editor-backdrop" data-editor-close></div>
      <section class="admin-editor-panel" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title">
        <div class="admin-editor-header">
          <div>
            <p class="admin-editor-kicker">Admin Editor</p>
            <h2 id="admin-editor-title">Edit Content</h2>
          </div>
          <div class="admin-editor-header-actions">
            <button class="admin-editor-back" id="admin-editor-back" type="button" hidden aria-label="Go back">
              <ion-icon name="arrow-back-outline"></ion-icon>
            </button>
            <button class="admin-editor-close" type="button" data-editor-close aria-label="Close editor">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
        </div>
        <form id="admin-editor-form" class="admin-editor-form">
          <div class="admin-editor-meta">
            <span id="admin-editor-table">Table: -</span>
            <span id="admin-editor-row">Row ID: -</span>
          </div>
          <div id="admin-editor-fields" class="admin-editor-fields"></div>
          <div class="admin-editor-actions">
            <span id="admin-editor-status" class="admin-editor-status"></span>
            <button class="admin-editor-save" type="submit">Save Changes</button>
          </div>
        </form>
      </section>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);

  const modal = document.getElementById("admin-editor-modal");
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-editor-close]")) {
      closeEditor();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEditor();
    }
  });

  document.getElementById("admin-editor-form").addEventListener("submit", saveEditorForm);
  document.getElementById("admin-editor-back").addEventListener("click", () => {
    if (typeof editorBackHandler === "function") {
      const backFn = editorBackHandler;
      closeEditor();
      backFn();
    }
  });
}

function prettifyLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getFieldType(field) {
  if (field.type) return field.type;
  if (DEFAULT_TEXTAREA_FIELDS.has(field.name)) return "textarea";
  if (field.name.includes("date")) return "date";
  if (field.name === "dob") return "date";
  if (field.name.includes("email")) return "email";
  if (field.name.includes("phone") || field.name === "country_code") return "text";
  if (field.name.includes("link") || field.name.includes("url") || field.name.includes("instagram") || field.name.includes("facebook") || field.name.includes("twitter") || field.name.includes("linkedin")) return "url";
  return "text";
}

function buildFieldMarkup(field) {
  const label = field.label || prettifyLabel(field.name);
  const resolvedType = field.storageFolder && !field.type ? "file" : getFieldType(field);
  const type = resolvedType;
  const value = field.value ?? "";

  if (type === "file") {
    const hasValue = Boolean(value);
    const downloadUrl = hasValue ? getStorage(field.storageFolder, value) : "";

    return `
      <div
        class="admin-editor-field admin-editor-file-field"
        data-field-name="${field.name}"
        data-storage-folder="${field.storageFolder || ""}"
        data-current-file="${String(value)}"
        data-pending-action="keep"
        data-upload-base-name="${field.uploadBaseName || ""}"
        data-file-kind="file"
      >
        <span>${label}</span>
        <div class="admin-editor-image-card">
          <div class="admin-editor-file-display">
            <div class="admin-editor-file-icon">
              <ion-icon name="document-outline"></ion-icon>
            </div>
            <div class="admin-editor-file-meta">
              <strong>${hasValue ? value : "No file selected"}</strong>
              <span>${hasValue ? "Current uploaded file" : "Choose a new file to upload"}</span>
            </div>
          </div>
          <input type="hidden" name="${field.name}" value="${String(value).replace(/"/g, "&quot;")}">
          <input
            class="admin-editor-file-input"
            type="file"
            accept="${field.accept || "*/*"}"
            hidden
          >
          <div class="admin-editor-file-actions">
            <button type="button" class="admin-editor-file-btn" data-file-action="replace">Replace</button>
            <button type="button" class="admin-editor-file-btn" data-file-action="remove">Remove</button>
            <a
              class="admin-editor-file-btn admin-editor-file-download${hasValue ? "" : " is-disabled"}"
              data-file-action="download"
              href="${downloadUrl}"
              ${hasValue ? `download="${String(value).replace(/"/g, "&quot;")}"` : `aria-disabled="true" tabindex="-1"`}
            >Download</a>
            <button type="button" class="admin-editor-file-btn" data-file-action="undo" hidden>Undo</button>
          </div>
          <p class="admin-editor-file-note">Current file: <strong>${hasValue ? value : "None"}</strong></p>
        </div>
      </div>
    `;
  }

  if (type === "select") {
    const options = (field.options || [])
      .map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        const selected = String(optionValue) === String(value) ? " selected" : "";

        return `<option value="${String(optionValue).replace(/"/g, "&quot;")}"${selected}>${optionLabel}</option>`;
      })
      .join("");

    return `
      <label class="admin-editor-field">
        <span>${label}</span>
        <select name="${field.name}">${options}</select>
      </label>
    `;
  }

  if (type === "image") {
    const hasValue = Boolean(value);
    const previewUrl = hasValue ? getStorage(field.storageFolder, value) : "";

    return `
      <div
        class="admin-editor-field admin-editor-file-field"
        data-field-name="${field.name}"
        data-storage-folder="${field.storageFolder || ""}"
        data-current-file="${String(value)}"
        data-pending-action="keep"
        data-upload-base-name="${field.uploadBaseName || ""}"
        data-file-kind="image"
      >
        <span>${label}</span>
        <div class="admin-editor-image-card">
          <div class="admin-editor-image-preview-wrap">
            <img
              class="admin-editor-image-preview${hasValue ? "" : " is-empty"}"
              src="${previewUrl}"
              alt="${label}"
              ${hasValue ? "" : "hidden"}
            >
            <div class="admin-editor-image-empty"${hasValue ? " hidden" : ""}>No image selected</div>
          </div>
          <input type="hidden" name="${field.name}" value="${String(value).replace(/"/g, "&quot;")}">
          <input
            class="admin-editor-file-input"
            type="file"
            accept="image/*"
            hidden
          >
          <div class="admin-editor-file-actions">
            <button type="button" class="admin-editor-file-btn" data-file-action="replace">Replace</button>
            <button type="button" class="admin-editor-file-btn" data-file-action="remove">Remove</button>
            <a
              class="admin-editor-file-btn admin-editor-file-download${hasValue ? "" : " is-disabled"}"
              data-file-action="download"
              href="${previewUrl}"
              ${hasValue ? `download="${String(value).replace(/"/g, "&quot;")}"` : `aria-disabled="true" tabindex="-1"`}
            >Download</a>
            <button type="button" class="admin-editor-file-btn" data-file-action="undo" hidden>Undo</button>
          </div>
          <p class="admin-editor-file-note">Current file: <strong>${hasValue ? value : "None"}</strong></p>
        </div>
      </div>
    `;
  }

  if (type === "textarea") {
    return `
      <label class="admin-editor-field">
        <span>${label}</span>
        <textarea name="${field.name}" rows="5">${String(value).replace(/</g, "&lt;")}</textarea>
      </label>
    `;
  }

  return `
    <label class="admin-editor-field">
      <span>${label}</span>
      <input type="${type}" name="${field.name}" value="${String(value).replace(/"/g, "&quot;")}">
    </label>
  `;
}

function setStatus(message, isError = false) {
  const status = document.getElementById("admin-editor-status");
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

async function triggerBrowserDownload(url, filename) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${filename}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement("a");
  tempLink.href = blobUrl;
  tempLink.download = filename;
  tempLink.style.display = "none";
  document.body.appendChild(tempLink);
  tempLink.click();
  tempLink.remove();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}

function buildRlsHelpMessage(context, statusCode, errorText) {
  const normalizedError = (errorText || "").toLowerCase();

  if (
    statusCode === 403 ||
    normalizedError.includes("row-level security") ||
    normalizedError.includes("unauthorized")
  ) {
    return `${context} is blocked by Supabase RLS. Add the required policy for this table/storage path, or perform uploads through a secure backend/service-role endpoint.`;
  }

  return errorText || `${context} failed.`;
}

function getStorageObjectUrl(folder, fileName) {
  return `${SUPABASE_CONFIG.url}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

function getStorageRemoveUrl() {
  return `${SUPABASE_CONFIG.url}/storage/v1/object/${STORAGE_BUCKET}`;
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

function buildUploadedFileName(table, rowId, fieldName, file, uploadBaseName = "") {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "bin";
  if (uploadBaseName) {
    return `${sanitizeFilenamePart(uploadBaseName)}.${extension}`;
  }
  const originalBaseName = file.name.includes(".")
    ? file.name.split(".").slice(0, -1).join(".")
    : file.name;

  const cleanOriginalBaseName = sanitizeFilenamePart(originalBaseName);
  const fallbackName = `${sanitizeFilenamePart(table)}-${sanitizeFilenamePart(fieldName)}`;

  return `${cleanOriginalBaseName || fallbackName}.${extension}`;
}

async function deleteStorageFile(folder, fileName) {
  if (!folder || !fileName) return;

  const objectPath = `${folder}/${fileName}`;

  const response = await fetch(getStorageRemoveUrl(), {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_CONFIG.key,
      Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
      "Content-Type": "application/json"
    }
    ,
    body: JSON.stringify({
      prefixes: [objectPath]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const normalizedError = (errorText || "").toLowerCase();

    // If storage metadata says the object is already missing, we can still
    // safely clear the filename in the table and continue.
    if (
      response.status === 404 ||
      normalizedError.includes("object not found") ||
      normalizedError.includes("not_found")
    ) {
      return;
    }

    throw new Error(errorText || `Failed to delete ${fileName}`);
  }
}

async function uploadStorageFile(folder, fileName, file) {
  const response = await fetch(getStorageObjectUrl(folder, fileName), {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.key,
      Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
      "x-upsert": "true",
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(buildRlsHelpMessage(`Upload for ${folder}/${fileName}`, response.status, errorText));
  }
}

function updateImageFieldState(fieldWrap, action) {
  const preview = fieldWrap.querySelector(".admin-editor-image-preview");
  const emptyState = fieldWrap.querySelector(".admin-editor-image-empty");
  const hiddenInput = fieldWrap.querySelector(`input[type="hidden"][name="${fieldWrap.dataset.fieldName}"]`);
  const fileInput = fieldWrap.querySelector(".admin-editor-file-input");
  const note = fieldWrap.querySelector(".admin-editor-file-note strong");
  const fileMetaTitle = fieldWrap.querySelector(".admin-editor-file-meta strong");
  const fileMetaSubtitle = fieldWrap.querySelector(".admin-editor-file-meta span");
  const downloadLink = fieldWrap.querySelector('[data-file-action="download"]');
  const undoButton = fieldWrap.querySelector('[data-file-action="undo"]');
  const currentFile = fieldWrap.dataset.currentFile;
  const isFileKind = fieldWrap.dataset.fileKind === "file";

  fieldWrap.dataset.pendingAction = action;

  if (action === "remove") {
    hiddenInput.value = "";
    if (isFileKind) {
      if (fileMetaTitle) fileMetaTitle.textContent = "Will be removed on save";
      if (fileMetaSubtitle) fileMetaSubtitle.textContent = "No replacement selected";
    } else {
      preview.hidden = true;
      preview.classList.add("is-empty");
      preview.removeAttribute("src");
      emptyState.hidden = false;
    }
    note.textContent = "Will be removed on save";
    if (downloadLink) {
      downloadLink.classList.add("is-disabled");
      downloadLink.removeAttribute("href");
      downloadLink.removeAttribute("download");
      downloadLink.setAttribute("aria-disabled", "true");
      downloadLink.setAttribute("tabindex", "-1");
    }
    undoButton.hidden = false;
    fileInput.value = "";
    return;
  }

  if (action === "keep") {
    hiddenInput.value = currentFile;
    note.textContent = currentFile || "None";
    undoButton.hidden = true;
    fileInput.value = "";

    if (currentFile) {
      const currentUrl = getStorage(fieldWrap.dataset.storageFolder, currentFile);
      if (isFileKind) {
        if (fileMetaTitle) fileMetaTitle.textContent = currentFile;
        if (fileMetaSubtitle) fileMetaSubtitle.textContent = "Current uploaded file";
      } else {
        preview.src = currentUrl;
        preview.hidden = false;
        preview.classList.remove("is-empty");
        emptyState.hidden = true;
      }
      if (downloadLink) {
        downloadLink.href = currentUrl;
        downloadLink.download = currentFile;
        downloadLink.classList.remove("is-disabled");
        downloadLink.removeAttribute("aria-disabled");
        downloadLink.removeAttribute("tabindex");
      }
    } else {
      if (isFileKind) {
        if (fileMetaTitle) fileMetaTitle.textContent = "No file selected";
        if (fileMetaSubtitle) fileMetaSubtitle.textContent = "Choose a new file to upload";
      } else {
        preview.hidden = true;
        preview.classList.add("is-empty");
        preview.removeAttribute("src");
        emptyState.hidden = false;
      }
      if (downloadLink) {
        downloadLink.classList.add("is-disabled");
        downloadLink.removeAttribute("href");
        downloadLink.removeAttribute("download");
        downloadLink.setAttribute("aria-disabled", "true");
        downloadLink.setAttribute("tabindex", "-1");
      }
    }
  }
}

function bindFileFieldEvents() {
  document.querySelectorAll(".admin-editor-file-field").forEach((fieldWrap) => {
    const fileInput = fieldWrap.querySelector(".admin-editor-file-input");
    const replaceButton = fieldWrap.querySelector('[data-file-action="replace"]');
    const removeButton = fieldWrap.querySelector('[data-file-action="remove"]');
    const undoButton = fieldWrap.querySelector('[data-file-action="undo"]');
    const preview = fieldWrap.querySelector(".admin-editor-image-preview");
    const emptyState = fieldWrap.querySelector(".admin-editor-image-empty");
    const note = fieldWrap.querySelector(".admin-editor-file-note strong");
    const fileMetaTitle = fieldWrap.querySelector(".admin-editor-file-meta strong");
    const fileMetaSubtitle = fieldWrap.querySelector(".admin-editor-file-meta span");
    const downloadLink = fieldWrap.querySelector('[data-file-action="download"]');
    const isFileKind = fieldWrap.dataset.fileKind === "file";

    downloadLink?.addEventListener("click", async (event) => {
      if (downloadLink.classList.contains("is-disabled")) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      const downloadUrl = downloadLink.getAttribute("href");
      const filename = downloadLink.getAttribute("download") || fieldWrap.dataset.currentFile || "download";

      try {
        await triggerBrowserDownload(downloadUrl, filename);
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    replaceButton.addEventListener("click", () => {
      fileInput.click();
    });

    removeButton.addEventListener("click", () => {
      updateImageFieldState(fieldWrap, "remove");
    });

    undoButton.addEventListener("click", () => {
      updateImageFieldState(fieldWrap, "keep");
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      fieldWrap.dataset.pendingAction = "replace";
      if (isFileKind) {
        if (fileMetaTitle) fileMetaTitle.textContent = file.name;
        if (fileMetaSubtitle) fileMetaSubtitle.textContent = "New file selected";
      } else {
        const objectUrl = URL.createObjectURL(file);
        preview.src = objectUrl;
        preview.hidden = false;
        preview.classList.remove("is-empty");
        emptyState.hidden = true;
        if (downloadLink) {
          downloadLink.href = objectUrl;
        }
      }
      note.textContent = file.name;
      if (downloadLink) {
        if (isFileKind) {
          const objectUrl = URL.createObjectURL(file);
          downloadLink.href = objectUrl;
        }
        downloadLink.download = file.name;
        downloadLink.classList.remove("is-disabled");
        downloadLink.removeAttribute("aria-disabled");
        downloadLink.removeAttribute("tabindex");
      }
      undoButton.hidden = false;
    });
  });
}

export function openEditor(config) {
  ensureEditorMounted();
  currentEditorConfig = config;

  const modal = document.getElementById("admin-editor-modal");
  const fieldsContainer = document.getElementById("admin-editor-fields");
  const title = document.getElementById("admin-editor-title");
  const tableMeta = document.getElementById("admin-editor-table");
  const rowMeta = document.getElementById("admin-editor-row");
  const form = document.getElementById("admin-editor-form");
  const backButton = document.getElementById("admin-editor-back");

  const rowId = config.row?.id ?? "";
  const fields = config.fields || Object.entries(config.row || {})
    .filter(([key]) => key !== "id")
    .map(([name, value]) => ({ name, value }));

  form.dataset.table = config.table;
  form.dataset.rowId = rowId;
  form.dataset.refreshMode = config.refreshMode || "reload";
  form.dataset.method = config.method || (rowId ? "PATCH" : "POST");
  editorBackHandler = typeof config.onBack === "function" ? config.onBack : null;
  const shouldShowBackButton = config.showBackButton === false
    ? false
    : Boolean(editorBackHandler);

  title.textContent = config.title || `Edit ${config.table}`;
  tableMeta.textContent = `Table: ${config.table}`;
  rowMeta.textContent = `Row ID: ${rowId || "-"}`;
  fieldsContainer.innerHTML = fields.map(buildFieldMarkup).join("");
  bindFileFieldEvents();
  setStatus("");
  backButton.hidden = !shouldShowBackButton;
  backButton.style.display = shouldShowBackButton ? "flex" : "none";
  if (typeof config.onOpen === "function") {
    config.onOpen({ form, fieldsContainer, config });
  }

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

export function closeEditor() {
  const modal = document.getElementById("admin-editor-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  editorBackHandler = null;
}

async function saveEditorForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const table = form.dataset.table;
  const rowId = form.dataset.rowId;
  const method = form.dataset.method || "PATCH";
  const formData = new FormData(form);
  let payload = {};

  formData.forEach((value, key) => {
    payload[key] = value;
  });

  setStatus("Saving...");

  try {
    const fileFields = Array.from(form.querySelectorAll(".admin-editor-file-field"));

    for (const fieldWrap of fileFields) {
      const fieldName = fieldWrap.dataset.fieldName;
      const storageFolder = fieldWrap.dataset.storageFolder;
      const currentFile = fieldWrap.dataset.currentFile;
      const pendingAction = fieldWrap.dataset.pendingAction;
      const uploadBaseName = fieldWrap.dataset.uploadBaseName;
      const fileInput = fieldWrap.querySelector(".admin-editor-file-input");
      const replacementFile = fileInput.files?.[0];

      if (pendingAction === "remove") {
        if (currentFile) {
          await deleteStorageFile(storageFolder, currentFile);
        }
        payload[fieldName] = "";
        continue;
      }

      if (pendingAction === "replace" && replacementFile) {
        const newFileName = buildUploadedFileName(table, rowId || "row", fieldName, replacementFile, uploadBaseName);
        await uploadStorageFile(storageFolder, newFileName, replacementFile);

        if (currentFile && currentFile !== newFileName) {
          await deleteStorageFile(storageFolder, currentFile);
        }

        payload[fieldName] = newFileName;
      }
    }

    if (typeof currentEditorConfig?.transformPayload === "function") {
      payload = await currentEditorConfig.transformPayload({
        form,
        formData,
        payload,
        rowId,
        table
      });
    }

    let response;

    if (typeof currentEditorConfig?.submitHandler === "function") {
      response = await currentEditorConfig.submitHandler({
        table,
        rowId,
        method,
        payload,
        headers: HEADERS,
        dbBase: DB_BASE
      });
    } else {
      const requestUrl = method === "POST"
        ? `${DB_BASE}/${table}`
        : `${DB_BASE}/${table}?id=eq.${encodeURIComponent(rowId)}`;

      response = await fetch(requestUrl, {
        method,
        headers: {
          ...HEADERS,
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(buildRlsHelpMessage(`${method === "POST" ? "Insert" : "Update"} for table ${table}`, response.status, errorText));
    }

    setStatus("Saved successfully.");

    setTimeout(() => {
      if (form.dataset.refreshMode === "reload") {
        window.location.reload();
      } else {
        closeEditor();
      }
    }, 500);
  } catch (error) {
    setStatus(error.message, true);
  }
}

export function addEditButton(target, config) {
  ensureEditorMounted();

  if (!target || target.querySelector(":scope > .admin-edit-btn")) {
    return;
  }

  if (getComputedStyle(target).position === "static") {
    target.style.position = "relative";
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-edit-btn";
  if (config.buttonClassName) {
    button.classList.add(...config.buttonClassName.split(" ").filter(Boolean));
  }
  button.setAttribute("aria-label", `Edit ${config.title || config.table}`);
  button.innerHTML = `<ion-icon name="create-outline"></ion-icon><span>Edit</span>`;

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof config.onClick === "function") {
      config.onClick(event);
      return;
    }
    openEditor(config);
  });

  target.appendChild(button);
}
