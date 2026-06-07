import { getTable } from "./db.js";
import { getStorage } from "./config.js";
import { openEditor } from "./editor-tools.js";
import { DB_BASE, SUPABASE_CONFIG } from "./config.js";

const DEFAULT_SOCIAL_LINKS = [
  { platform: "Git", label: "Git", icon: "g", url: "https://github.com/" },
  { platform: "Facebook", label: "Facebook", icon: "Facebook.png", url: "https://facebook.com/" },
  { platform: "Instagram", label: "Instagram", icon: "Instagram.png", url: "https://instagram.com/" },
  { platform: "Linked-In", label: "LinkedIn", icon: "Linked-In.png", url: "https://linkedin.com/in/" },
  { platform: "X-Corp", label: "X Corp", icon: "X-Corp.png", url: "https://x.com/" }
];

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let socialRows = [];
const DEFAULT_ICON_FILENAMES = new Set(DEFAULT_SOCIAL_LINKS.map((item) => item.icon));

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await fetchAndUpdateSocialLinks();
  } catch (error) {
    console.error("Error fetching social data:", error);
  }
});

function getDefaultPlatformConfig(platform) {
  return DEFAULT_SOCIAL_LINKS.find((item) => item.platform === platform);
}

function getIconFilename(row) {
  return row.icon || getDefaultPlatformConfig(row.platform)?.icon || `${row.platform}.png`;
}

function resolveSocialIconUrl(iconFilename) {
  if (!iconFilename) return "";
  if (DEFAULT_ICON_FILENAMES.has(iconFilename)) {
    return `./assets/images/logo/${iconFilename}`;
  }
  return getStorage("logo", iconFilename);
}

function getMissingDefaultPlatforms(rows) {
  const existingPlatforms = new Set(rows.map((row) => row.platform));
  return DEFAULT_SOCIAL_LINKS.filter((item) => !existingPlatforms.has(item.platform));
}

function buildSocialLinkUrl(url) {
  return url || "#";
}

async function submitSocialLink({ table, rowId, method, payload, headers, dbBase }) {
  const requestUrl = method === "POST"
    ? `${dbBase}/${table}`
    : `${dbBase}/${table}?id=eq.${encodeURIComponent(rowId)}`;

  const makeRequest = (bodyPayload) => fetch(requestUrl, {
    method,
    headers: {
      ...headers,
      Prefer: "return=representation"
    },
    body: JSON.stringify(bodyPayload)
  });

  const response = await makeRequest(payload);

  if (response.ok) {
    return response;
  }

  const errorText = await response.text();
  const normalizedError = errorText.toLowerCase();

  if (normalizedError.includes("icon") && normalizedError.includes("column")) {
    return makeRequest({
      platform: payload.platform,
      url: payload.url
    });
  }

  return new Response(errorText, {
    status: response.status,
    statusText: response.statusText
  });
}

async function handleSocialSave(args) {
  const response = await submitSocialLink(args);

  if (response.ok) {
    try {
      socialRows = await getTable("social_links");
    } catch (error) {
      console.error("[SOCIAL] Failed to refresh rows after save:", error);
    }

    insertSocialLinks(socialRows);
    renderSocialManagerList(socialRows);
    setTimeout(() => {
      openSocialManager();
    }, 550);
  }

  return response;
}

function bindSocialFormBehavior(form, initialDefaultConfig) {
  const templateSelect = form.querySelector('[name="platform_template"]');
  const platformInput = form.querySelector('[name="platform"]');
  const urlInput = form.querySelector('[name="url"]');
  const iconInput = form.querySelector('[name="icon"]');
  const iconField = iconInput?.closest(".admin-editor-file-field");
  const iconPreview = iconField?.querySelector(".admin-editor-image-preview");
  const iconPreviewEmpty = iconField?.querySelector(".admin-editor-image-empty");
  const iconDownload = iconField?.querySelector('[data-file-action="download"]');
  const iconNote = iconField?.querySelector(".admin-editor-file-note strong");
  const undoButton = iconField?.querySelector('[data-file-action="undo"]');
  const fileInput = iconField?.querySelector(".admin-editor-file-input");

  const updateIconPreview = () => {
    const iconValue = iconInput?.value?.trim();
    const hasValue = Boolean(iconValue);
    const iconUrl = hasValue ? resolveSocialIconUrl(iconValue) : "";

    if (!iconPreview || !iconPreviewEmpty || !iconDownload) return;

    if (hasValue) {
      iconPreview.src = iconUrl;
      iconPreview.hidden = false;
      iconPreview.classList.remove("is-empty");
      iconPreviewEmpty.hidden = true;
      iconDownload.href = iconUrl;
      iconDownload.download = iconValue;
      iconDownload.classList.remove("is-disabled");
      iconDownload.removeAttribute("aria-disabled");
      iconDownload.removeAttribute("tabindex");
      if (iconNote) iconNote.textContent = iconValue;
    } else {
      iconPreview.hidden = true;
      iconPreview.classList.add("is-empty");
      iconPreview.removeAttribute("src");
      iconPreviewEmpty.hidden = false;
      iconDownload.classList.add("is-disabled");
      iconDownload.removeAttribute("href");
      iconDownload.removeAttribute("download");
      iconDownload.setAttribute("aria-disabled", "true");
      iconDownload.setAttribute("tabindex", "-1");
      if (iconNote) iconNote.textContent = "None";
    }

    if (undoButton) undoButton.hidden = true;
    if (fileInput) fileInput.value = "";
  };

  const applyTemplate = (selectedValue) => {
    const config = getDefaultPlatformConfig(selectedValue);

    if (config) {
      platformInput.value = config.platform;
      if (
        !urlInput.value ||
        urlInput.value === "mailto:" ||
        urlInput.value === "tel:" ||
        /^https?:\/\/(github|facebook|instagram|linkedin|x)\.com/i.test(urlInput.value)
      ) {
        urlInput.value = config.url;
      }
      iconInput.value = config.icon;
      updateIconPreview();
    } else if (selectedValue === "custom") {
      if (!platformInput.value || getDefaultPlatformConfig(platformInput.value)) {
        platformInput.value = "";
      }
      if (!iconInput.value || DEFAULT_SOCIAL_LINKS.some((item) => item.icon === iconInput.value)) {
        iconInput.value = "";
      }
      updateIconPreview();
    }
  };

  templateSelect?.addEventListener("change", () => {
    applyTemplate(templateSelect.value);
  });

  platformInput?.addEventListener("input", () => {
    const config = getDefaultPlatformConfig(platformInput.value.trim());
    if (config) {
      iconInput.value = config.icon;
      updateIconPreview();
    }
  });

  iconInput?.addEventListener("input", updateIconPreview);

  if (initialDefaultConfig) {
    platformInput.value = initialDefaultConfig.platform;
    if (!urlInput.value) {
      urlInput.value = initialDefaultConfig.url;
    }
    iconInput.value = initialDefaultConfig.icon;
  }

  updateIconPreview();
}

function openSocialEditor(row) {
  const defaultConfig = getDefaultPlatformConfig(row.platform);

  openEditor({
    table: "social_links",
    row,
    title: `${row.platform} Link`,
    refreshMode: "close",
    fields: [
      {
        name: "platform_template",
        label: "Template",
        type: "select",
        value: row.platform,
        options: [
          ...DEFAULT_SOCIAL_LINKS.map((item) => ({ value: item.platform, label: item.label })),
          { value: "custom", label: "Add New" }
        ]
      },
      { name: "platform", label: "Platform", value: row.platform },
      { name: "url", label: "Link", value: row.url, type: "text" },
      { name: "icon", label: "Icon", value: getIconFilename(row), type: "image", storageFolder: "logo" }
    ],
    onOpen: ({ form }) => bindSocialFormBehavior(form, defaultConfig),
    onBack: openSocialManager,
    transformPayload: ({ payload }) => ({
      platform: payload.platform?.trim(),
      url: payload.url?.trim(),
      icon: payload.icon?.trim()
    }),
    submitHandler: handleSocialSave
  });
}

function openAddSocialEditor() {
  const missingDefaults = getMissingDefaultPlatforms(socialRows);
  const firstOption = missingDefaults[0]?.platform || "custom";

  openEditor({
    table: "social_links",
    title: "Add Social Link",
    method: "POST",
    refreshMode: "close",
    fields: [
      {
        name: "platform_template",
        label: "Add From",
        type: "select",
        value: firstOption,
        options: [
          ...missingDefaults.map((item) => ({ value: item.platform, label: `${item.label} (Default)` })),
          { value: "custom", label: "Add New" }
        ]
      },
      { name: "platform", label: "Platform", value: "" },
      { name: "url", label: "Link", value: "", type: "text" },
      { name: "icon", label: "Icon", value: "", type: "image", storageFolder: "logo" }
    ],
    onOpen: ({ form }) => bindSocialFormBehavior(form, getDefaultPlatformConfig(firstOption)),
    onBack: openSocialManager,
    transformPayload: ({ payload }) => ({
      platform: payload.platform?.trim(),
      url: payload.url?.trim(),
      icon: payload.icon?.trim()
    }),
    submitHandler: handleSocialSave
  });
}

async function deleteSocialLink(row) {
  const confirmed = window.confirm(`Delete ${row.platform} social link?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${DB_BASE}/social_links?id=eq.${encodeURIComponent(row.id)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    socialRows = socialRows.filter((item) => String(item.id) !== String(row.id));
    insertSocialLinks(socialRows);
    renderSocialManagerList(socialRows);
    openSocialManager();
  } catch (error) {
    window.alert(`Failed to delete social link.\n${error.message}`);
  }
}

function ensureSocialManagerModal() {
  if (document.getElementById("admin-social-manager")) {
    return;
  }

  const modal = document.createElement("div");
  modal.id = "admin-social-manager";
  modal.className = "admin-social-manager";
  modal.innerHTML = `
    <div class="admin-social-manager-backdrop" data-close-social-manager></div>
    <section class="admin-social-manager-panel">
      <div class="admin-social-manager-header">
        <div>
          <p class="admin-social-manager-kicker">Social Links</p>
          <h3>Manage Social Links</h3>
        </div>
        <button type="button" class="admin-social-manager-close" data-close-social-manager aria-label="Close social manager">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
      <div class="admin-social-manager-toolbar">
        <button type="button" class="admin-social-manager-add">Add Social Link</button>
      </div>
      <div class="admin-social-manager-list" id="admin-social-manager-list"></div>
    </section>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-social-manager]")) {
      closeSocialManager();
    }
  });

  modal.querySelector(".admin-social-manager-add").addEventListener("click", () => {
    closeSocialManager();
    openAddSocialEditor();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSocialManager();
    }
  });
}

async function fetchAndUpdateSocialLinks({ preserveOnEmpty = false } = {}) {
  try {
    const socials = await getTable("social_links");
    if (
      Array.isArray(socials) &&
      (socials.length || !preserveOnEmpty || !socialRows.length)
    ) {
      socialRows = socials;
    }

    insertSocialLinks(socialRows);
    document.querySelector(".admin-social-links-inline")?.remove();
    ensureSocialManagerModal();

    const modal = document.getElementById("admin-social-manager");
    if (modal?.classList.contains("active")) {
      renderSocialManagerList(socialRows);
    }
  } catch (error) {
    console.error("[SOCIAL] Error fetching social links:", error);
  }
}

function renderSocialManagerList(rows = socialRows) {
  const list = document.querySelector("#admin-social-manager #admin-social-manager-list");
  if (!list) return;

  if (!rows.length) {
    const btn = document.createElement("button");
    btn.className = "admin-social-manager-btn primary";
    btn.textContent = "Add Default Platforms";
    btn.addEventListener("click", async () => {
      try {
        const missing = getMissingDefaultPlatforms(rows);
        for (const config of missing) {
          await fetch(`${DB_BASE}/social_links`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
              platform: config.platform,
              url: config.url,
              icon: config.icon
            })
          });
        }
        window.location.reload();
      } catch (e) { alert(e.message); }
    });
    list.innerHTML = '<div class="admin-social-manager-empty"><p>No social links. </p></div>';
    list.appendChild(btn);
    return;
  }

  list.innerHTML = "";

  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "admin-social-manager-card";
    const main = document.createElement("div");
    main.className = "admin-social-manager-card-main";

    const icon = document.createElement("img");
    icon.src = resolveSocialIconUrl(getIconFilename(row));
    icon.alt = row.platform || "Social icon";
    icon.width = 22;

    const copy = document.createElement("div");
    copy.className = "admin-social-manager-copy";

    const title = document.createElement("strong");
    title.textContent = row.platform || "Untitled";

    const url = document.createElement("span");
    url.textContent = row.url || "No link set";

    copy.appendChild(title);
    copy.appendChild(url);
    main.appendChild(icon);
    main.appendChild(copy);

    const actions = document.createElement("div");
    actions.className = "admin-social-manager-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "admin-social-manager-btn";
    editButton.dataset.action = "edit";
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-social-manager-btn danger";
    deleteButton.dataset.action = "delete";
    deleteButton.textContent = "Delete";

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    card.appendChild(main);
    card.appendChild(actions);

    editButton.addEventListener("click", () => {
      closeSocialManager();
      openSocialEditor(row);
    });

    deleteButton.addEventListener("click", () => {
      closeSocialManager();
      deleteSocialLink(row);
    });

    list.appendChild(card);
  });
}

async function openSocialManager() {
  ensureSocialManagerModal();
  renderSocialManagerList(socialRows);

  const modal = document.getElementById("admin-social-manager");
  if (!modal) return;
  modal.classList.add("active");

  try {
    await fetchAndUpdateSocialLinks({ preserveOnEmpty: true });
  } catch (error) {
    console.error("[SOCIAL] Failed to refresh manager rows:", error);
  }
}

function closeSocialManager() {
  const modal = document.getElementById("admin-social-manager");
  if (!modal) return;
  modal.classList.remove("active");
}

function insertSocialLinks(rows = socialRows) {
  const socialList = document.querySelector(".social-list");
  if (!socialList) {
    console.error("[SOCIAL] .social-list not found");
    return;
  }

  socialList.innerHTML = "";

  rows.forEach((row) => {
    const listItem = document.createElement("li");
    listItem.classList.add("social-item");

    const linkElement = document.createElement("a");
    linkElement.classList.add("social-link");
    linkElement.href = buildSocialLinkUrl(row.url);

    if (!String(row.url).startsWith("mailto:") && !String(row.url).startsWith("tel:")) {
      linkElement.target = "_blank";
    }

    const imgElement = document.createElement("img");
    imgElement.src = resolveSocialIconUrl(getIconFilename(row));
    imgElement.alt = row.platform;
    imgElement.width = 18;

    linkElement.appendChild(imgElement);
    listItem.appendChild(linkElement);
    socialList.appendChild(listItem);
  });

  const managerItem = document.createElement("li");
  managerItem.className = "social-item social-item-manager";
  managerItem.innerHTML = `
    <button type="button" class="admin-social-manager-trigger" aria-label="Manage social links">
      <span class="admin-social-manager-ring">
        <ion-icon name="settings-outline"></ion-icon>
      </span>
    </button>
  `;

  managerItem.querySelector("button").addEventListener("click", openSocialManager);
  socialList.appendChild(managerItem);
}
