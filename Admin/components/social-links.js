import { getTable } from "./db.js";
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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    socialRows = await getTable("social_links");
    insertSocialLinks(socialRows);
    ensureSocialManagerModal();
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

function bindSocialFormBehavior(form, initialDefaultConfig) {
  const templateSelect = form.querySelector('[name="platform_template"]');
  const platformInput = form.querySelector('[name="platform"]');
  const urlInput = form.querySelector('[name="url"]');
  const iconInput = form.querySelector('[name="icon"]');
  const iconField = iconInput?.closest(".admin-editor-field");

  if (iconField && !iconField.querySelector(".admin-icon-tools")) {
    const tools = document.createElement("div");
    tools.className = "admin-icon-tools";
    tools.innerHTML = `
      <div class="admin-icon-preview-wrap">
        <img class="admin-icon-preview" alt="Icon preview" hidden>
        <span class="admin-icon-preview-empty">No icon preview</span>
      </div>
      <a class="admin-editor-file-btn admin-editor-file-download is-disabled admin-icon-download" aria-disabled="true" tabindex="-1">Download Icon</a>
    `;
    iconField.appendChild(tools);
  }

  const iconPreview = form.querySelector(".admin-icon-preview");
  const iconPreviewEmpty = form.querySelector(".admin-icon-preview-empty");
  const iconDownload = form.querySelector(".admin-icon-download");

  const updateIconPreview = () => {
    const iconValue = iconInput?.value?.trim();
    const hasValue = Boolean(iconValue);
    const iconUrl = hasValue ? `./assets/images/logo/${iconValue}` : "";

    if (!iconPreview || !iconPreviewEmpty || !iconDownload) return;

    if (hasValue) {
      iconPreview.src = iconUrl;
      iconPreview.hidden = false;
      iconPreviewEmpty.hidden = true;
      iconDownload.href = iconUrl;
      iconDownload.download = iconValue;
      iconDownload.classList.remove("is-disabled");
      iconDownload.removeAttribute("aria-disabled");
      iconDownload.removeAttribute("tabindex");
    } else {
      iconPreview.hidden = true;
      iconPreview.removeAttribute("src");
      iconPreviewEmpty.hidden = false;
      iconDownload.classList.add("is-disabled");
      iconDownload.removeAttribute("href");
      iconDownload.removeAttribute("download");
      iconDownload.setAttribute("aria-disabled", "true");
      iconDownload.setAttribute("tabindex", "-1");
    }
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
      { name: "url", label: "Link", value: row.url, type: "url" },
      { name: "icon", label: "Icon", value: getIconFilename(row) }
    ],
    onOpen: ({ form }) => bindSocialFormBehavior(form, defaultConfig),
    onBack: openSocialManager,
    transformPayload: ({ payload }) => ({
      platform: payload.platform?.trim(),
      url: payload.url?.trim(),
      icon: payload.icon?.trim()
    }),
    submitHandler: submitSocialLink
  });
}

function openAddSocialEditor() {
  const missingDefaults = getMissingDefaultPlatforms(socialRows);
  const firstOption = missingDefaults[0]?.platform || "custom";

  openEditor({
    table: "social_links",
    title: "Add Social Link",
    method: "POST",
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
      { name: "url", label: "Link", value: "", type: "url" },
      { name: "icon", label: "Icon", value: "" }
    ],
    onOpen: ({ form }) => bindSocialFormBehavior(form, getDefaultPlatformConfig(firstOption)),
    onBack: openSocialManager,
    transformPayload: ({ payload }) => ({
      platform: payload.platform?.trim(),
      url: payload.url?.trim(),
      icon: payload.icon?.trim()
    }),
    submitHandler: submitSocialLink
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

    window.location.reload();
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
      <div class="admin-social-manager-list"></div>
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

function renderSocialManagerList() {
  const list = document.querySelector(".admin-social-manager-list");
  if (!list) return;

  if (!socialRows.length) {
    list.innerHTML = `<div class="admin-social-manager-empty">No social links yet. Add one to get started.</div>`;
    return;
  }

  list.innerHTML = "";

  socialRows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "admin-social-manager-card";
    card.innerHTML = `
      <div class="admin-social-manager-card-main">
        <img src="./assets/images/logo/${getIconFilename(row)}" alt="${row.platform}" width="22">
        <div class="admin-social-manager-copy">
          <strong>${row.platform}</strong>
          <span>${row.url}</span>
        </div>
      </div>
      <div class="admin-social-manager-actions">
        <button type="button" class="admin-social-manager-btn" data-action="edit">Edit</button>
        <button type="button" class="admin-social-manager-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      closeSocialManager();
      openSocialEditor(row);
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", () => {
      closeSocialManager();
      deleteSocialLink(row);
    });

    list.appendChild(card);
  });
}

function openSocialManager() {
  renderSocialManagerList();
  const modal = document.getElementById("admin-social-manager");
  if (!modal) return;
  modal.classList.add("active");
}

function closeSocialManager() {
  const modal = document.getElementById("admin-social-manager");
  if (!modal) return;
  modal.classList.remove("active");
}

function insertSocialLinks(rows) {
  const socialList = document.querySelector(".social-list");
  if (!socialList) return;

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
    imgElement.src = `./assets/images/logo/${getIconFilename(row)}`;
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
