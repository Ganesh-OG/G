const PROJECT_POPUP_ID = "project-popup-modal";
const PROJECT_VIEW_PATH = "/project-view.html";

function normalizeProjectTitle(title) {
  return String(title || "Project Preview").trim() || "Project Preview";
}

function normalizeProjectFileName(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) return "";
  return normalized.replace(/^\/+/, "");
}

function normalizeProjectDataFileName(fileName) {
  const normalized = normalizeProjectFileName(fileName);
  if (!normalized) return "";

  if (/\.(json)$/i.test(normalized)) return normalized;
  if (/\.(html?)$/i.test(normalized)) {
    return normalized.replace(/\.(html?)$/i, ".json");
  }

  return `${normalized}.json`;
}

function buildProjectViewUrl(fileName) {
  const normalized = normalizeProjectDataFileName(fileName);
  const file = normalized || "404.json";

  const params = new URLSearchParams();
  params.set("file", file);
  return `${PROJECT_VIEW_PATH}?${params.toString()}`;
}

function buildProject404Url(title) {
  const params = new URLSearchParams();
  params.set("file", "404.json");
  params.set("title", normalizeProjectTitle(title));
  return `${PROJECT_VIEW_PATH}?${params.toString()}`;
}

async function resolveProjectPopupUrl({ fileName, title }) {
  const projectViewUrl = buildProjectViewUrl(fileName);

  try {
    const response = await fetch(projectViewUrl, { cache: "no-store" });
    return response.ok ? projectViewUrl : buildProject404Url(title);
  } catch {
    return buildProject404Url(title);
  }
}

function ensureProjectPopupModal() {
  let modal = document.getElementById(PROJECT_POPUP_ID);
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = PROJECT_POPUP_ID;
  modal.className = "project-popup-modal";
  modal.innerHTML = `
    <div class="project-popup-backdrop" data-project-popup-close></div>
    <section class="project-popup-panel" role="dialog" aria-modal="true" aria-labelledby="project-popup-title">
      <button type="button" class="project-popup-close" data-project-popup-close aria-label="Close project popup">
        <ion-icon name="close-outline"></ion-icon>
      </button>
      <div class="project-popup-header">
        <h3 id="project-popup-title">Project Preview</h3>
      </div>
      <iframe class="project-popup-frame" title="Project preview"></iframe>
    </section>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-project-popup-close]")) {
      modal.classList.remove("active");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      modal.classList.remove("active");
    }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "project-document-close") {
      modal.classList.remove("active");
    }
  });

  document.body.appendChild(modal);
  return modal;
}

export async function openProjectPopup({ title, fileName }) {
  const modal = ensureProjectPopupModal();
  const titleEl = modal.querySelector("#project-popup-title");
  const frame = modal.querySelector(".project-popup-frame");
  const popupTitle = normalizeProjectTitle(title);

  titleEl.textContent = popupTitle;
  frame.removeAttribute("srcdoc");
  frame.src = await resolveProjectPopupUrl({ fileName, title: popupTitle });
  modal.classList.add("active");
}
