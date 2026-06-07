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

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createBlockId() {
  return globalThis.crypto?.randomUUID?.() || `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeBuilderAlign(value = "left") {
  const normalized = String(value || "").toLowerCase();
  return ["left", "center", "right"].includes(normalized) ? normalized : "left";
}

function createBuilderDefaults(type) {
  switch (type) {
    case "heading":
      return { type, level: 2, text: "Heading", fontSize: 28, align: "left" };
    case "paragraph":
      return { type, text: "Paragraph text", fontSize: 18, align: "left" };
    case "image":
      return { type, src: "", alt: "Image", width: 100, align: "center" };
    case "button":
      return { type, label: "Button", url: "#" };
    case "quote":
      return { type, text: "Quote text", fontSize: 18, align: "left" };
    case "code":
      return { type, code: "// code snippet", copyable: "false" };
    case "divider":
      return { type };
    default:
      return { type: "paragraph", text: "Paragraph text", fontSize: 18, align: "left" };
  }
}

function parseBuilderBlocks(html) {
  const normalized = String(html || "").trim();
  if (!normalized) {
    return [];
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(`<div id="builder-root">${normalized}</div>`, "text/html");
  const root = documentFragment.getElementById("builder-root");
  if (!root) return [];

  const blocks = [];

  const pushBlock = (block) => {
    blocks.push({ id: createBlockId(), ...block });
  };

  const readText = (node) => String(node?.textContent || "").trim();
  const getStyleValue = (element, propertyName) => String(element?.style?.[propertyName] || "").trim();

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = readText(node);
      if (text) pushBlock({ type: "paragraph", text });
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node;
    const tagName = element.tagName.toLowerCase();

    if (/^h[1-3]$/.test(tagName)) {
      pushBlock({
        type: "heading",
        level: Number(tagName.slice(1)),
        text: readText(element) || "Heading",
        fontSize: clampNumber(parseFloat(getStyleValue(element, "fontSize")), 14, 72, Number(tagName.slice(1)) === 1 ? 34 : Number(tagName.slice(1)) === 2 ? 28 : 22),
        align: normalizeBuilderAlign(getStyleValue(element, "textAlign"))
      });
      return;
    }

    if (tagName === "p") {
      const buttonLink = element.querySelector(".project-content-button");
      if (buttonLink) {
        pushBlock({
          type: "button",
          label: readText(buttonLink) || "Button",
          url: buttonLink.getAttribute("href") || "#"
        });
        return;
      }

      pushBlock({
        type: "paragraph",
        text: readText(element) || "Paragraph text",
        fontSize: clampNumber(parseFloat(getStyleValue(element, "fontSize")), 12, 48, 18),
        align: normalizeBuilderAlign(getStyleValue(element, "textAlign"))
      });
      return;
    }

    if (tagName === "blockquote") {
      pushBlock({
        type: "quote",
        text: readText(element) || "Quote text",
        fontSize: clampNumber(parseFloat(getStyleValue(element, "fontSize")), 12, 48, 18),
        align: normalizeBuilderAlign(getStyleValue(element, "textAlign"))
      });
      return;
    }

    if (tagName === "figure") {
      const image = element.querySelector("img");
      if (image) {
        pushBlock({
          type: "image",
          src: image.getAttribute("src") || "",
          alt: image.getAttribute("alt") || "Image",
          width: clampNumber(parseFloat(getStyleValue(image, "width")), 20, 100, Number(image.getAttribute("width")) || 100),
          align: normalizeBuilderAlign(element.getAttribute("data-align") || getStyleValue(element, "textAlign") || "center")
        });
      }
      return;
    }

    if (tagName === "img") {
      pushBlock({
        type: "image",
        src: element.getAttribute("src") || "",
        alt: element.getAttribute("alt") || "Image",
        width: clampNumber(parseFloat(getStyleValue(element, "width")), 20, 100, Number(element.getAttribute("width")) || 100),
        align: normalizeBuilderAlign(getStyleValue(element, "textAlign") || "center")
      });
      return;
    }

    if (tagName === "a" && element.classList.contains("project-content-button")) {
      pushBlock({
        type: "button",
        label: readText(element) || "Button",
        url: element.getAttribute("href") || "#"
      });
      return;
    }

    if (tagName === "pre") {
      pushBlock({
        type: "code",
        code: readText(element) || "// code snippet",
        copyable: String(element.getAttribute("data-copyable") || "false")
      });
      return;
    }

    if (tagName === "div" && element.classList.contains("project-code-block")) {
      const code = element.querySelector("pre code") || element.querySelector("code");
      pushBlock({
        type: "code",
        code: readText(code) || "// code snippet",
        copyable: String(element.getAttribute("data-copyable") || code?.getAttribute?.("data-copyable") || "false")
      });
      return;
    }

    if (tagName === "hr") {
      pushBlock({ type: "divider" });
      return;
    }

    const text = readText(element);
    if (text) {
      pushBlock({ type: "paragraph", text });
    }
  });

  return blocks;
}

function serializeBuilderBlocks(blocks) {
  return blocks.map((block) => {
    const textAlign = normalizeBuilderAlign(block.align);
    const fontSize = clampNumber(block.fontSize, 10, 72, 18);
    switch (block.type) {
      case "heading": {
        const level = Math.min(Math.max(Number(block.level) || 2, 1), 3);
        return `<h${level} style="font-size:${clampNumber(block.fontSize, 18, 72, level === 1 ? 34 : level === 2 ? 28 : 22)}px;text-align:${textAlign};">${escapeHtml(block.text || "Heading")}</h${level}>`;
      }
      case "paragraph":
        return `<p style="font-size:${fontSize}px;text-align:${textAlign};">${escapeHtml(block.text || "Paragraph text").replace(/\n/g, "<br>")}</p>`;
      case "image":
        return `<figure class="project-content-media" data-align="${textAlign}" style="text-align:${textAlign};"><img src="${escapeAttribute(block.src || "")}" alt="${escapeAttribute(block.alt || "Image")}" style="width:${clampNumber(block.width, 20, 100, 100)}%;max-width:${clampNumber(block.width, 20, 100, 100)}%;" /></figure>`;
      case "button":
        return `<p><a class="project-content-button" href="${escapeAttribute(block.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(block.label || "Button")}</a></p>`;
      case "quote":
        return `<blockquote style="font-size:${fontSize}px;text-align:${textAlign};"><p>${escapeHtml(block.text || "Quote text").replace(/\n/g, "<br>")}</p></blockquote>`;
      case "code":
        return `
          <div class="project-code-block" data-copyable="${String(block.copyable || "false")}">
            <div class="project-code-block-header">
              <span>Terminal</span>
              <button type="button" class="project-code-copy-btn" ${String(block.copyable || "false") === "true" ? "" : "hidden"}>Copy</button>
            </div>
            <pre><code>${escapeHtml(block.code || "// code snippet")}</code></pre>
          </div>
        `;
      case "divider":
        return "<hr>";
      default:
        return "";
    }
  }).join("");
}

function buildBuilderBlockMarkup(block = {}, index = 0) {
  const blockId = block.id || createBlockId();
  const type = block.type || "paragraph";
  const titleMap = {
    heading: "Heading",
    paragraph: "Paragraph",
    image: "Image",
    button: "Button",
    quote: "Quote",
    code: "Code",
    divider: "Divider"
  };
  const title = titleMap[type] || "Block";
  const align = normalizeBuilderAlign(block.align);
  const fontSize = clampNumber(block.fontSize, 10, 72, type === "heading" ? 28 : 18);
  const width = clampNumber(block.width, 20, 100, 100);
  const copyable = String(block.copyable || "false");
  const headingLabel = type === "heading" ? `H${clampNumber(block.level, 1, 3, 2)}` : title;
  const moveControls = type === "divider"
    ? ""
    : `
      <button type="button" data-builder-action="move-up" aria-label="Move block up">↑</button>
      <button type="button" data-builder-action="move-down" aria-label="Move block down">↓</button>
    `;

  const controls = type === "divider"
    ? ""
    : type === "image"
      ? `
        <button type="button" data-builder-action="align-left" aria-label="Align left">Left</button>
        <button type="button" data-builder-action="align-center" aria-label="Align center">Center</button>
        <button type="button" data-builder-action="align-right" aria-label="Align right">Right</button>
        <button type="button" data-builder-action="width-down" aria-label="Decrease image size">A-</button>
        <button type="button" data-builder-action="width-up" aria-label="Increase image size">A+</button>
      `
      : type === "code"
        ? `<button type="button" data-builder-action="copy-toggle" aria-label="Toggle copy">Copy: ${copyable === "true" ? "On" : "Off"}</button>`
        : `
          <button type="button" data-builder-action="size-down" aria-label="Decrease size">A-</button>
          <button type="button" data-builder-action="size-up" aria-label="Increase size">A+</button>
          <button type="button" data-builder-action="align-left" aria-label="Align left">Left</button>
          <button type="button" data-builder-action="align-center" aria-label="Align center">Center</button>
          <button type="button" data-builder-action="align-right" aria-label="Align right">Right</button>
        `;

  const headerExtra = type === "heading"
    ? `<span class="admin-builder-block-badge">${headingLabel}</span>`
    : type === "image"
      ? `<span class="admin-builder-block-badge">${Math.round(width)}%</span>`
      : type === "code"
        ? `<span class="admin-builder-block-badge">Terminal</span>`
        : "";

  if (type === "divider") {
    return `
      <article class="admin-builder-block" data-builder-block data-block-id="${blockId}" data-block-type="${type}" draggable="true">
        <div class="admin-builder-block-header">
          <button type="button" class="admin-builder-block-handle" data-builder-drag-handle aria-label="Drag block">
            <ion-icon name="reorder-three-outline"></ion-icon>
          </button>
          <strong>${title}</strong>
          <div class="admin-builder-block-actions">
            <button type="button" data-builder-action="duplicate">Duplicate</button>
            <button type="button" data-builder-action="remove">Delete</button>
          </div>
        </div>
        <div class="admin-builder-block-body admin-builder-block-body--divider">
          <hr>
        </div>
      </article>
    `;
  }

  if (type === "image") {
    return `
      <article class="admin-builder-block" data-builder-block data-block-id="${blockId}" data-block-type="${type}" draggable="true">
        <div class="admin-builder-block-header">
          <button type="button" class="admin-builder-block-handle" data-builder-drag-handle aria-label="Drag block">
            <ion-icon name="reorder-three-outline"></ion-icon>
          </button>
          <strong>${title}</strong>
          ${headerExtra}
          <div class="admin-builder-block-actions">
            ${moveControls}
            ${controls}
            <button type="button" data-builder-action="duplicate">Duplicate</button>
            <button type="button" data-builder-action="remove">Delete</button>
          </div>
        </div>
        <div class="admin-builder-block-body">
          <div class="admin-builder-image-preview" data-builder-image-preview style="text-align:${align};">
            <img src="${escapeAttribute(block.src || "")}" alt="${escapeAttribute(block.alt || "Image")}" style="width:${width}%;">
          </div>
          <label>
            <span>Image URL</span>
            <input type="url" data-builder-field="src" value="${escapeAttribute(block.src || "")}" placeholder="https://...">
          </label>
          <label>
            <span>Alt Text</span>
            <input type="text" data-builder-field="alt" value="${escapeAttribute(block.alt || "")}" placeholder="Describe the image">
          </label>
          <label>
            <span>Width</span>
            <input type="range" min="20" max="100" step="1" data-builder-field="width" value="${width}">
          </label>
          <p class="admin-builder-image-hint">Use alignment for left, center, or right placement. Use move up/down to position the image in the document.</p>
          <label>
            <span>Alignment</span>
            <select data-builder-field="align">
              <option value="left"${align === "left" ? " selected" : ""}>Left</option>
              <option value="center"${align === "center" ? " selected" : ""}>Center</option>
              <option value="right"${align === "right" ? " selected" : ""}>Right</option>
            </select>
          </label>
        </div>
      </article>
    `;
  }

  if (type === "code") {
    return `
      <article class="admin-builder-block" data-builder-block data-block-id="${blockId}" data-block-type="${type}" draggable="true" data-copyable="${copyable}">
        <div class="admin-builder-block-header">
          <button type="button" class="admin-builder-block-handle" data-builder-drag-handle aria-label="Drag block">
            <ion-icon name="reorder-three-outline"></ion-icon>
          </button>
          <strong>${title}</strong>
          ${headerExtra}
          <div class="admin-builder-block-actions">
            ${controls}
            <button type="button" data-builder-action="duplicate">Duplicate</button>
            <button type="button" data-builder-action="remove">Delete</button>
          </div>
        </div>
        <div class="admin-builder-block-body">
          <div class="admin-builder-code-terminal">
            <div class="admin-builder-code-terminal-bar">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <label>
              <span>Code</span>
              <textarea class="admin-builder-code-editor" data-builder-field="code" rows="12" placeholder="// code snippet">${escapeHtml(block.code || "")}</textarea>
            </label>
          </div>
          <label>
            <span>Copy</span>
            <select data-builder-field="copyable">
              <option value="false"${copyable !== "true" ? " selected" : ""}>Disable Copy</option>
              <option value="true"${copyable === "true" ? " selected" : ""}>Enable Copy</option>
            </select>
          </label>
        </div>
      </article>
    `;
  }

  const defaultText = type === "heading" ? "Heading" : type === "quote" ? "Quote text" : "Paragraph text";
  const contentText = escapeHtml(block.text || defaultText);
  const textRole = type === "heading" ? "heading" : type === "quote" ? "quote" : "paragraph";
  const isBlankParagraph = type === "paragraph" && !String(block.text || "").trim();

  if (isBlankParagraph) {
    return `
      <article class="admin-builder-block admin-builder-block--blank" data-builder-block data-block-id="${blockId}" data-block-type="${type}" draggable="true">
        <div class="admin-builder-block-body">
          <div
            class="admin-builder-text-editor admin-builder-text-editor--blank"
            data-builder-field="text"
            contenteditable="true"
            spellcheck="true"
            data-text-role="${textRole}"
            data-placeholder="Type here"
            style="font-size:${fontSize}px;text-align:${align};"
          ></div>
          <input type="hidden" data-builder-field="fontSize" value="${fontSize}">
          <input type="hidden" data-builder-field="align" value="${align}">
        </div>
      </article>
    `;
  }

  return `
    <article class="admin-builder-block" data-builder-block data-block-id="${blockId}" data-block-type="${type}" draggable="true">
      <div class="admin-builder-block-header">
        <button type="button" class="admin-builder-block-handle" data-builder-drag-handle aria-label="Drag block">
          <ion-icon name="reorder-three-outline"></ion-icon>
        </button>
        <strong>${title}</strong>
        ${headerExtra}
        <div class="admin-builder-block-actions">
          ${controls}
          <button type="button" data-builder-action="duplicate">Duplicate</button>
          <button type="button" data-builder-action="remove">Delete</button>
        </div>
      </div>
      <div class="admin-builder-block-body">
        <div
          class="admin-builder-text-editor"
          data-builder-field="text"
          contenteditable="true"
          spellcheck="true"
          data-text-role="${textRole}"
          style="font-size:${fontSize}px;text-align:${align};"
        >${contentText}</div>
        ${type === "heading" ? `
          <label>
            <span>Level</span>
            <select data-builder-field="level">
              <option value="1"${Number(block.level) === 1 ? " selected" : ""}>H1</option>
              <option value="2"${Number(block.level) === 2 || !block.level ? " selected" : ""}>H2</option>
              <option value="3"${Number(block.level) === 3 ? " selected" : ""}>H3</option>
            </select>
          </label>
        ` : ""}
        <input type="hidden" data-builder-field="fontSize" value="${fontSize}">
        <input type="hidden" data-builder-field="align" value="${align}">
      </div>
    </article>
  `;
}

function applyBuilderBlockVisualState(blockElement) {
  const blockType = blockElement.dataset.blockType || "paragraph";
  const textEditor = blockElement.querySelector("[data-builder-field='text'][contenteditable='true']");
  const fontSizeField = blockElement.querySelector("[data-builder-field='fontSize']");
  const alignField = blockElement.querySelector("[data-builder-field='align']");
  const widthField = blockElement.querySelector("[data-builder-field='width']");
  const imagePreview = blockElement.querySelector("[data-builder-image-preview] img");
  const imageWrap = blockElement.querySelector("[data-builder-image-preview]");
  const codeEditor = blockElement.querySelector(".admin-builder-code-editor");
  const copyableField = blockElement.querySelector("[data-builder-field='copyable']");
  const copyToggle = blockElement.querySelector('[data-builder-action="copy-toggle"]');

  const fontSize = clampNumber(fontSizeField?.value, 10, 72, blockType === "heading" ? 28 : 18);
  const align = normalizeBuilderAlign(alignField?.value || "left");
  const isBlankParagraph = blockType === "paragraph" && !String(textEditor?.innerText || "").trim();

  blockElement.classList.toggle("admin-builder-block--blank", isBlankParagraph);

  if (textEditor) {
    textEditor.style.fontSize = `${fontSize}px`;
    textEditor.style.textAlign = align;
  }

  if (imagePreview) {
    const width = clampNumber(widthField?.value, 20, 100, 100);
    const imageAlign = normalizeBuilderAlign(alignField?.value || "center");
    imagePreview.style.width = `${width}%`;
    imagePreview.style.maxWidth = `${width}%`;
    if (imageWrap) {
      imageWrap.style.textAlign = imageAlign;
    }
  }

  if (codeEditor) {
    codeEditor.closest(".admin-builder-block")?.setAttribute("data-copyable", copyableField?.value || "false");
  }

  if (copyToggle && copyableField) {
    copyToggle.textContent = `Copy: ${copyableField.value === "true" ? "On" : "Off"}`;
  }
}

function setSelectedBuilderBlock(fieldWrap, blockElement) {
  const canvas = fieldWrap.querySelector("[data-builder-canvas]");
  if (!canvas) return;

  canvas.querySelectorAll("[data-builder-block]").forEach((item) => {
    item.classList.toggle("is-selected", item === blockElement);
  });

  fieldWrap.dataset.selectedBlockId = blockElement?.dataset.blockId || "";
}

function getSelectedBuilderBlock(fieldWrap) {
  const canvas = fieldWrap.querySelector("[data-builder-canvas]");
  if (!canvas) return null;
  const selectedId = fieldWrap.dataset.selectedBlockId || "";
  if (selectedId) {
    const selected = canvas.querySelector(`[data-builder-block][data-block-id="${selectedId}"]`);
    if (selected) return selected;
  }
  return canvas.querySelector("[data-builder-block].is-selected") || null;
}

function getBuilderActionBlock(fieldWrap, event) {
  const clickedBlock = event.target.closest("[data-builder-block]");
  if (clickedBlock) {
    setSelectedBuilderBlock(fieldWrap, clickedBlock);
    return clickedBlock;
  }

  return getSelectedBuilderBlock(fieldWrap);
}

function syncBuilderField(fieldWrap) {
  const textarea = fieldWrap.querySelector(`textarea[name="${fieldWrap.dataset.builderField}"]`);
  const canvas = fieldWrap.querySelector("[data-builder-canvas]");
  if (!textarea || !canvas) return;

  canvas.querySelectorAll("[data-builder-block]").forEach((blockElement) => {
    applyBuilderBlockVisualState(blockElement);
  });

  const blocks = Array.from(canvas.querySelectorAll("[data-builder-block]")).map((blockElement) => {
    const blockType = blockElement.dataset.blockType || "paragraph";
    const block = {
      id: blockElement.dataset.blockId || createBlockId(),
      type: blockType
    };

    blockElement.querySelectorAll("[data-builder-field]").forEach((input) => {
      const key = input.dataset.builderField;
      if (!key) return;
      if (input.isContentEditable) {
        block[key] = String(input.innerText || "").trim();
        return;
      }
      block[key] = input.value;
    });

    return block;
  });

  textarea.value = serializeBuilderBlocks(blocks);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function addBuilderBlock(fieldWrap, type, insertAfterElement = null, preset = {}) {
  const canvas = fieldWrap.querySelector("[data-builder-canvas]");
  if (!canvas) return;

  const block = {
    id: createBlockId(),
    ...createBuilderDefaults(type),
    ...preset
  };
  if (insertAfterElement && insertAfterElement.parentElement === canvas) {
    insertAfterElement.insertAdjacentHTML("afterend", buildBuilderBlockMarkup(block));
    const insertedBlock = insertAfterElement.nextElementSibling;
    if (insertedBlock) {
      setSelectedBuilderBlock(fieldWrap, insertedBlock);
    }
  } else {
    canvas.insertAdjacentHTML("beforeend", buildBuilderBlockMarkup(block));
    setSelectedBuilderBlock(fieldWrap, canvas.lastElementChild);
  }
  canvas.querySelectorAll("[data-builder-block]").forEach((blockElement) => applyBuilderBlockVisualState(blockElement));
  syncBuilderField(fieldWrap);
}

function bindBuilderFieldEvents() {
  document.querySelectorAll(".admin-editor-builder-field").forEach((fieldWrap) => {
    const canvas = fieldWrap.querySelector("[data-builder-canvas]");
    const toolbarButtons = fieldWrap.querySelectorAll("[data-builder-add]");
    const toolbarActionButtons = fieldWrap.querySelectorAll("[data-builder-toolbar] [data-builder-action]");
    const textarea = fieldWrap.querySelector(`textarea[name="${fieldWrap.dataset.builderField}"]`);
    const imageInput = fieldWrap.querySelector(".admin-editor-builder-image-input");
    if (!canvas || !textarea) return;

    const initialBlocks = parseBuilderBlocks(textarea.value);
    canvas.innerHTML = initialBlocks.map((block, index) => buildBuilderBlockMarkup(block, index)).join("");
    canvas.querySelectorAll("[data-builder-block]").forEach((blockElement) => applyBuilderBlockVisualState(blockElement));
    if (canvas.firstElementChild) {
      setSelectedBuilderBlock(fieldWrap, canvas.firstElementChild);
    } else {
      addBuilderBlock(fieldWrap, "paragraph", null, { text: "" });
      canvas.querySelector("[data-builder-field='text'][contenteditable='true']")?.focus();
    }

    const refresh = () => syncBuilderField(fieldWrap);
    const addImageBlockFromFile = (file) => {
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        addBuilderBlock(fieldWrap, "image", null, {
          src: String(reader.result || ""),
          alt: file.name || "Image"
        });
        refresh();
      };
      reader.readAsDataURL(file);
    };

    toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        addBuilderBlock(fieldWrap, button.dataset.builderAdd);
        refresh();
      });
    });

    toolbarActionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.builderAction;
        const activeBlock = getSelectedBuilderBlock(fieldWrap) || canvas.lastElementChild;
        if (!activeBlock && !action.startsWith("insert-")) return;

        if (action === "remove" && activeBlock) {
          activeBlock.remove();
          setSelectedBuilderBlock(fieldWrap, canvas.lastElementChild || null);
          refresh();
          return;
        }

        if (action === "duplicate" && activeBlock) {
          const clone = activeBlock.cloneNode(true);
          clone.dataset.blockId = createBlockId();
          activeBlock.insertAdjacentElement("afterend", clone);
          applyBuilderBlockVisualState(clone);
          setSelectedBuilderBlock(fieldWrap, clone);
          refresh();
          return;
        }

        if (action === "move-up" && activeBlock) {
          const previous = activeBlock.previousElementSibling;
          if (previous) {
            activeBlock.parentElement.insertBefore(activeBlock, previous);
            setSelectedBuilderBlock(fieldWrap, activeBlock);
            refresh();
          }
          return;
        }

        if (action === "move-down" && activeBlock) {
          const next = activeBlock.nextElementSibling;
          if (next) {
            activeBlock.parentElement.insertBefore(next, activeBlock);
            setSelectedBuilderBlock(fieldWrap, activeBlock);
            refresh();
          }
          return;
        }

        if (action === "size-up" && activeBlock) {
          const field = activeBlock.querySelector("[data-builder-field='fontSize']");
          if (field) field.value = String(clampNumber(Number(field.value) + 2, 10, 72, 18));
        }

        if (action === "size-down" && activeBlock) {
          const field = activeBlock.querySelector("[data-builder-field='fontSize']");
          if (field) field.value = String(clampNumber(Number(field.value) - 2, 10, 72, 18));
        }

        if (action === "width-up" && activeBlock) {
          const field = activeBlock.querySelector("[data-builder-field='width']");
          if (field) field.value = String(clampNumber(Number(field.value) + 10, 20, 100, 100));
        }

        if (action === "width-down" && activeBlock) {
          const field = activeBlock.querySelector("[data-builder-field='width']");
          if (field) field.value = String(clampNumber(Number(field.value) - 10, 20, 100, 100));
        }

        if ((action === "align-left" || action === "align-center" || action === "align-right") && activeBlock) {
          const field = activeBlock.querySelector("[data-builder-field='align']");
          if (field) field.value = action.replace("align-", "");
        }

        if (action === "copy-toggle" && activeBlock) {
          const field = activeBlock.querySelector('[data-builder-field="copyable"]');
          if (field) {
            field.value = field.value === "true" ? "false" : "true";
          }
        }

        if (action === "insert-image-url") {
          const imageUrl = promptForUrl("Enter image URL");
          if (!imageUrl) return;
          addBuilderBlock(fieldWrap, "image", null, {
            src: imageUrl,
            alt: "Image"
          });
          refresh();
          return;
        }

        if (action === "insert-image-upload") {
          imageInput?.click();
          return;
        }

        refresh();
      });
    });

    canvas.addEventListener("input", refresh);
    canvas.addEventListener("change", refresh);

    canvas.addEventListener("click", (event) => {
      const block = event.target.closest("[data-builder-block]");
      if (!block) return;
      setSelectedBuilderBlock(fieldWrap, block);

      const actionButton = event.target.closest("[data-builder-action]");
      if (!actionButton) return;

      const action = actionButton.dataset.builderAction;
      const setFieldValue = (fieldName, nextValue) => {
        const field = block.querySelector(`[data-builder-field="${fieldName}"]`);
        if (!field) return;
        field.value = nextValue;
      };
      const adjustNumericField = (fieldName, delta, min, max, fallback) => {
        const field = block.querySelector(`[data-builder-field="${fieldName}"]`);
        if (!field) return;
        field.value = String(clampNumber(Number(field.value) + delta, min, max, fallback));
      };
      const moveBlock = (direction) => {
        const sibling = direction === "up" ? block.previousElementSibling : block.nextElementSibling;
        if (!sibling) return;
        if (direction === "up") {
          block.parentElement.insertBefore(block, sibling);
        } else {
          block.parentElement.insertBefore(sibling, block);
        }
      };

      if (action === "remove") {
        block.remove();
        setSelectedBuilderBlock(fieldWrap, canvas.lastElementChild || null);
        refresh();
        return;
      }

      if (action === "duplicate") {
        const clone = block.cloneNode(true);
        clone.dataset.blockId = createBlockId();
        block.insertAdjacentElement("afterend", clone);
        applyBuilderBlockVisualState(clone);
        setSelectedBuilderBlock(fieldWrap, clone);
        refresh();
        return;
      }

      if (action === "move-up") {
        moveBlock("up");
        setSelectedBuilderBlock(fieldWrap, block);
        refresh();
        return;
      }

      if (action === "move-down") {
        moveBlock("down");
        setSelectedBuilderBlock(fieldWrap, block);
        refresh();
        return;
      }

      if (action === "size-up") {
        adjustNumericField("fontSize", 2, 10, 72, 18);
      }

      if (action === "size-down") {
        adjustNumericField("fontSize", -2, 10, 72, 18);
      }

      if (action === "width-up") {
        adjustNumericField("width", 10, 20, 100, 100);
      }

      if (action === "width-down") {
        adjustNumericField("width", -10, 20, 100, 100);
      }

      if (action === "align-left" || action === "align-center" || action === "align-right") {
        setFieldValue("align", action.replace("align-", ""));
      }

      if (action === "copy-toggle") {
        const copyField = block.querySelector('[data-builder-field="copyable"]');
        if (copyField) {
          copyField.value = copyField.value === "true" ? "false" : "true";
          actionButton.textContent = `Copy: ${copyField.value === "true" ? "On" : "Off"}`;
        }
      }

      applyBuilderBlockVisualState(block);
      refresh();
    });

    let draggedBlock = null;

    canvas.addEventListener("dragstart", (event) => {
      const block = event.target.closest("[data-builder-block]");
      if (!block) return;
      draggedBlock = block;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", block.dataset.blockId || "");
      block.classList.add("is-dragging");
    });

    canvas.addEventListener("dragend", () => {
      canvas.querySelectorAll(".is-dragging").forEach((block) => block.classList.remove("is-dragging"));
      canvas.querySelectorAll(".drop-before, .drop-after").forEach((block) => block.classList.remove("drop-before", "drop-after"));
      draggedBlock = null;
    });

    canvas.addEventListener("dragover", (event) => {
      const targetBlock = event.target.closest("[data-builder-block]");
      if (!targetBlock || !draggedBlock || targetBlock === draggedBlock) return;
      event.preventDefault();

      const bounds = targetBlock.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      targetBlock.classList.toggle("drop-before", before);
      targetBlock.classList.toggle("drop-after", !before);
    });

    canvas.addEventListener("dragleave", (event) => {
      const targetBlock = event.target.closest("[data-builder-block]");
      if (!targetBlock) return;
      targetBlock.classList.remove("drop-before", "drop-after");
    });

    canvas.addEventListener("drop", (event) => {
      const targetBlock = event.target.closest("[data-builder-block]");
      if (!targetBlock || !draggedBlock || targetBlock === draggedBlock) return;
      event.preventDefault();

      const bounds = targetBlock.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      targetBlock.classList.remove("drop-before", "drop-after");

      if (before) {
        canvas.insertBefore(draggedBlock, targetBlock);
      } else {
        canvas.insertBefore(draggedBlock, targetBlock.nextSibling);
      }
      refresh();
    });

    imageInput?.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (!file) return;
      addImageBlockFromFile(file);
      imageInput.value = "";
    });

    refresh();
  });
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

  if (type === "richtext") {
    return `
      <div class="admin-editor-field admin-editor-richtext-field" data-richtext-field="${field.name}">
        <span>${label}</span>
        <div class="admin-editor-richtext-toolbar">
          <button type="button" data-richtext-action="heading-one">H1</button>
          <button type="button" data-richtext-action="heading-two">H2</button>
          <button type="button" data-richtext-action="paragraph">Text</button>
          <button type="button" data-richtext-command="bold">Bold</button>
          <button type="button" data-richtext-command="italic">Italic</button>
          <button type="button" data-richtext-command="underline">Underline</button>
          <button type="button" data-richtext-command="insertUnorderedList">Bullet</button>
          <button type="button" data-richtext-command="insertOrderedList">Number</button>
          <button type="button" data-richtext-command="justifyLeft">Left</button>
          <button type="button" data-richtext-command="justifyCenter">Center</button>
          <button type="button" data-richtext-command="justifyRight">Right</button>
          <button type="button" data-richtext-action="quote">Quote</button>
          <button type="button" data-richtext-action="code">Code</button>
          <button type="button" data-richtext-action="divider">Divider</button>
          <button type="button" data-richtext-action="button-link">Button</button>
          <button type="button" data-richtext-action="link">Link</button>
          <button type="button" data-richtext-action="upload-image">Upload Image</button>
          <button type="button" data-richtext-action="image">Image</button>
          <button type="button" data-richtext-action="clear">Clear</button>
        </div>
        <div
          class="admin-editor-richtext-surface"
          contenteditable="true"
          spellcheck="true"
        >${String(value || "")}</div>
        <input class="admin-editor-richtext-image-input" type="file" accept="image/*" hidden>
        <textarea name="${field.name}" hidden>${String(value || "").replace(/</g, "&lt;")}</textarea>
        <p class="admin-editor-richtext-hint">Supports headings, text blocks, quotes, code blocks, links, image upload, and image drag-drop.</p>
      </div>
    `;
  }

  if (type === "textarea") {
    const placeholder = field.placeholder ? ` placeholder="${escapeAttribute(field.placeholder)}"` : "";

    return `
      <label class="admin-editor-field">
        <span>${label}</span>
        <textarea name="${field.name}" rows="5"${placeholder}>${String(value).replace(/</g, "&lt;")}</textarea>
        ${field.helpText ? `<small class="admin-editor-field-hint">${field.helpText}</small>` : ""}
      </label>
    `;
  }

  const placeholder = field.placeholder ? ` placeholder="${escapeAttribute(field.placeholder)}"` : "";

  return `
    <label class="admin-editor-field">
      <span>${label}</span>
      <input type="${type}" name="${field.name}" value="${String(value).replace(/"/g, "&quot;")}"${placeholder}>
      ${field.helpText ? `<small class="admin-editor-field-hint">${field.helpText}</small>` : ""}
    </label>
  `;
}

function syncRichTextField(fieldWrap) {
  const surface = fieldWrap.querySelector(".admin-editor-richtext-surface");
  const textarea = fieldWrap.querySelector(`textarea[name="${fieldWrap.dataset.richtextField}"]`);
  if (!surface || !textarea) return;
  textarea.value = surface.innerHTML.trim();
}

function insertHtmlAtCursor(html) {
  document.execCommand("insertHTML", false, html);
}

function formatBlock(tagName) {
  document.execCommand("formatBlock", false, tagName);
}

function promptForUrl(message) {
  const value = window.prompt(message);
  return value ? value.trim() : "";
}

function bindRichTextFieldEvents() {
  document.querySelectorAll(".admin-editor-richtext-field").forEach((fieldWrap) => {
    const surface = fieldWrap.querySelector(".admin-editor-richtext-surface");
    const toolbarButtons = fieldWrap.querySelectorAll("[data-richtext-command], [data-richtext-action]");
    const imageInput = fieldWrap.querySelector(".admin-editor-richtext-image-input");
    if (!surface) return;

    const focusSurface = () => {
      surface.focus();
    };

    const promptForLink = () => {
      const url = window.prompt("Enter hyperlink URL");
      if (!url) return;
      focusSurface();
      document.execCommand("createLink", false, url);
      syncRichTextField(fieldWrap);
    };

    const promptForImage = () => {
      const url = promptForUrl("Enter image URL");
      if (!url) return;
      focusSurface();
      insertHtmlAtCursor(`<figure class="project-content-media"><img src="${url.replace(/"/g, "&quot;")}" alt="" /></figure>`);
      syncRichTextField(fieldWrap);
    };

    const promptForButtonLink = () => {
      const label = window.prompt("Enter button label");
      if (!label) return;
      const url = promptForUrl("Enter button link URL");
      if (!url) return;
      focusSurface();
      insertHtmlAtCursor(`<p><a class="project-content-button" href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${label.replace(/</g, "&lt;")}</a></p>`);
      syncRichTextField(fieldWrap);
    };

    const insertUploadedImage = (src, altText = "") => {
      focusSurface();
      insertHtmlAtCursor(`<figure class="project-content-media"><img src="${src}" alt="${altText.replace(/"/g, "&quot;")}" /></figure>`);
      syncRichTextField(fieldWrap);
    };

    toolbarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.richtextCommand;
        const action = button.dataset.richtextAction;
        focusSurface();

        if (command) {
          document.execCommand(command, false);
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "link") {
          promptForLink();
          return;
        }

        if (action === "heading-one") {
          formatBlock("h1");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "heading-two") {
          formatBlock("h2");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "paragraph") {
          formatBlock("p");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "quote") {
          insertHtmlAtCursor("<blockquote><p>Quote text</p></blockquote>");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "code") {
          insertHtmlAtCursor("<pre><code>// code snippet</code></pre>");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "divider") {
          insertHtmlAtCursor("<hr>");
          syncRichTextField(fieldWrap);
          return;
        }

        if (action === "button-link") {
          promptForButtonLink();
          return;
        }

        if (action === "upload-image") {
          imageInput?.click();
          return;
        }

        if (action === "image") {
          promptForImage();
          return;
        }

        if (action === "clear") {
          surface.innerHTML = "";
          syncRichTextField(fieldWrap);
        }
      });
    });

    surface.addEventListener("input", () => syncRichTextField(fieldWrap));
    surface.addEventListener("blur", () => syncRichTextField(fieldWrap));
    surface.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    surface.addEventListener("drop", (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        insertUploadedImage(String(reader.result), file.name);
      };
      reader.readAsDataURL(file);
    });

    imageInput?.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        insertUploadedImage(String(reader.result), file.name);
        imageInput.value = "";
      };
      reader.readAsDataURL(file);
    });

    syncRichTextField(fieldWrap);
  });
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
  const panel = document.querySelector(".admin-editor-panel");

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
  panel?.classList.toggle("admin-editor-panel--wide", Boolean(config.widePanel));
  tableMeta.textContent = `Table: ${config.table}`;
  rowMeta.textContent = `Row ID: ${rowId || "-"}`;
  fieldsContainer.innerHTML = fields.map(buildFieldMarkup).join("");
  bindFileFieldEvents();
  bindRichTextFieldEvents();
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
    const onSaved = currentEditorConfig?.onSaved;
    const savedPayload = payload;

    setTimeout(() => {
      if (typeof onSaved === "function") {
        closeEditor();
        onSaved({ table, rowId, method, payload: savedPayload, response });
        return;
      }

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
