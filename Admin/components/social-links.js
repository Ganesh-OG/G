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

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await fetchAndUpdateSocialLinks();
  } catch (error) {
    console.error("Error fetching social data:", error);
  }
}); // Social manager UI enabled - gear icon + header button provides edit/delete/add options

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
      <div class="admin-logo-actions">
        <button type="button" class="admin-logo-action-btn admin-logo-replace" title="Replace Icon">
          <ion-icon name="image-outline"></ion-icon>
        </button>
        <a class="admin-editor-file-btn admin-editor-file-download is-disabled admin-icon-download" aria-disabled="true" tabindex="-1" title="Download Icon">Download Icon</a>
        <button type="button" class="admin-logo-action-btn admin-logo-remove" title="Remove Icon">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
        <button type="button" class="admin-logo-action-btn admin-logo-undo is-disabled" title="Undo Changes" aria-disabled="true" tabindex="-1">
          <ion-icon name="refresh-outline"></ion-icon>
        </button>
      </div>
    `;
    iconField.appendChild(tools);
  }

  // Logo action buttons
  const replaceBtn = tools.querySelector('.admin-logo-replace');
  const removeBtn = tools.querySelector('.admin-logo-remove');
  const undoBtn = tools.querySelector('.admin-logo-undo');

  let originalIconValue = iconInput.value?.trim() || '';
  let hasIconChanges = false;

  const updateUndoBtn = () => {
    const currentValue = iconInput.value?.trim() || '';
    const hasChanges = currentValue !== originalIconValue;
    undoBtn.disabled = !hasChanges;
    undoBtn.classList.toggle('is-disabled', !hasChanges);
    undoBtn.toggleAttribute('aria-disabled', !hasChanges);
    undoBtn.toggleAttribute('tabindex', !hasChanges ? '-1' : null);
  };

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

      // Update buttons
      replaceBtn.disabled = false;
      removeBtn.disabled = false;
      updateUndoBtn();
    } else {
      iconPreview.hidden = true;
      iconPreview.removeAttribute("src");
      iconPreviewEmpty.hidden = false;
      iconDownload.classList.add("is-disabled");
      iconDownload.removeAttribute("href");
      iconDownload.removeAttribute("download");
      iconDownload.setAttribute("aria-disabled", "true");
      iconDownload.setAttribute("tabindex", "-1");

      // Update buttons
      replaceBtn.disabled = false;
      removeBtn.disabled = true;
      updateUndoBtn();
    }
  };
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

      // Logo actions state
      replaceBtn.disabled = false;
      removeBtn.disabled = false;
      undoBtn.disabled = !originalIconValue || iconValue === originalIconValue;
    } else {
      iconPreview.hidden = true;
      iconPreview.removeAttribute("src");
      iconPreviewEmpty.hidden = false;
      iconDownload.classList.add("is-disabled");
      iconDownload.removeAttribute("href");
      iconDownload.removeAttribute("download");
      iconDownload.setAttribute("aria-disabled", "true");
      iconDownload.setAttribute("tabindex", "-1");

      // Logo actions state
      replaceBtn.disabled = false;
      removeBtn.disabled = true;
      undoBtn.disabled = true;
    }

    updateUndoBtn();
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
      const oldIcon = iconInput.value;
      iconInput.value = config.icon;
      if (oldIcon !== config.icon) hasIconChanges = true;
      updateIconPreview();
    } else if (selectedValue === "custom") {
      if (!platformInput.value || getDefaultPlatformConfig(platformInput.value)) {
        platformInput.value = "";
      }
      const oldIcon = iconInput.value;
      if (!iconInput.value || DEFAULT_SOCIAL_LINKS.some((item) => item.icon === iconInput.value)) {
        iconInput.value = "";
        hasIconChanges = true;
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

  // Logo button handlers
  replaceBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const newIconName = file.name.replace(/\.[^/.]+$/, '.png') || `${platformInput.value || 'logo'}.png`;
          iconInput.value = newIconName;
          hasIconChanges = true;
          updateIconPreview();
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  });

  removeBtn.addEventListener('click', () => {
    const oldValue = iconInput.value;
    iconInput.value = '';
    if (oldValue) hasIconChanges = true;
    updateIconPreview();
  });

  undoBtn.addEventListener('click', () => {
    iconInput.value = originalIconValue;
    hasIconChanges = false;
    updateIconPreview();
  });

  iconInput?.addEventListener("input", () => {
    hasIconChanges = true;
    updateIconPreview();
  });

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

async function fetchAndUpdateSocialLinks() {
  try {
    console.log('[SOCIAL] Fetching social_links...');
    const socials = await getTable("social_links");
    console.log('[SOCIAL] Fetched:', socials);
    socialRows = socials || [];

    const socialList = document.querySelector('.social-list');
    console.log('[SOCIAL] socialList found:', !!socialList, socialList);
    console.log('[SOCIAL] socialRows length:', socialRows.length);

    // Always insert links + gear
    insertSocialLinks(socialRows);
    
    // Add header Manage button (copy certifications pattern)
    const sidebarInfo = document.querySelector('.sidebar-info');
    if (sidebarInfo) {
      const existingControls = sidebarInfo.querySelector(".admin-section-header");
      existingControls?.remove();

      const titleRow = document.createElement("div");
      titleRow.className = "admin-section-header";

      const titleElements = sidebarInfo.querySelectorAll(".name, .title");
      titleElements.forEach(el => titleRow.appendChild(el.cloneNode(true)));

      const manageButton = document.createElement("button");
      manageButton.type = "button";
      manageButton.className = "admin-inline-action-btn";
      manageButton.textContent = "Manage Social Links";
      manageButton.addEventListener("click", openSocialManager);
      titleRow.appendChild(manageButton);
      
      sidebarInfo.appendChild(titleRow);
    }

    ensureSocialManagerModal();
    console.log('[SOCIAL] Setup complete - gear/header ready');
  } catch (error) {
    console.error("[SOCIAL] Error fetching social links:", error);
  }
}

function renderSocialManagerList() {
  const list = document.querySelector(".admin-social-manager-list");
  if (!list) return;

  if (!socialRows.length) {
    const btn = document.createElement("button");
    btn.className = "admin-social-manager-btn primary";
    btn.textContent = "Add Default Platforms";
    btn.addEventListener("click", async () => {
      try {
        const missing = getMissingDefaultPlatforms(socialRows);
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

function insertSocialLinks(rows = socialRows) {
  const socialList = document.querySelector(".social-list");
  if (!socialList) {
    console.error('[SOCIAL] .social-list not found');
    return;
  }

  console.log('[SOCIAL] Inserting', rows.length, 'links + gear to socialList');

  socialList.innerHTML = "";

  // Always add links (even if empty)
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

  // ALWAYS add gear manager (even if no links)
  const managerItem = document.createElement("li");
  managerItem.className = "social-item social-item-manager";
  managerItem.innerHTML = `
    <button type="button" class="admin-social-manager-trigger" aria-label="Manage social links">
      <span class="admin-social-manager-ring">
        <ion-icon name="settings-outline"></ion-icon>
      </span>
    </button>
  `;

  const triggerBtn = managerItem.querySelector("button");
  triggerBtn.addEventListener("click", openSocialManager);
  socialList.appendChild(managerItem);
  console.log('[SOCIAL] Gear icon appended');
}
