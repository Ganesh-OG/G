(() => {
  const PROJECT_VIEW_QUERY = "file";
  const SUPABASE_BASE_URL = "https://fbgpzymukqemldwiixqc.supabase.co";
  const SUPABASE_BUCKET = "portfolio";

  const html = document.documentElement;
  const body = document.body;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isAbsoluteUrl(value) {
    return /^(https?:)?\/\//i.test(String(value || "")) || String(value || "").startsWith("data:");
  }

  function normalizeRelativePath(value) {
    return String(value || "")
      .trim()
      .replace(/^\.?\//, "")
      .replace(/^\/+/, "");
  }

  function buildSupabaseImageUrl(folder, file) {
    const safeFolder = normalizeRelativePath(folder);
    const safeFile = normalizeRelativePath(file);
    if (!safeFolder || !safeFile) return "";
    return `${SUPABASE_BASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${encodeURIComponent(safeFolder)}/${encodeURIComponent(safeFile)}`;
  }

  function buildLocalImageUrl(folder, file) {
    const safeFolder = normalizeRelativePath(folder);
    const safeFile = normalizeRelativePath(file);
    if (!safeFolder && !safeFile) return "";
    if (safeFolder && safeFile) return `./${safeFolder}/${safeFile}`;
    return safeFolder ? `./${safeFolder}` : `./${safeFile}`;
  }

  function resolveImageSource(image = {}, block = {}) {
    const directSource = image.src || image.imageSrc || block.src || block.imageSrc || "";
    if (String(directSource).trim()) {
      return isAbsoluteUrl(directSource) ? String(directSource).trim() : `./${normalizeRelativePath(directSource)}`;
    }

    const location = String(image.location || image.source || block.location || block.source || "local").trim().toLowerCase();
    const folder = image.folder || image.path || block.folder || block.path || "";
    const file = image.file || block.file || "";

    if (location === "supabase") return buildSupabaseImageUrl(folder, file);
    return buildLocalImageUrl(folder, file);
  }

  function normalizeDataFilePath(fileName) {
    const normalized = String(fileName || "").trim().replace(/^\/+/, "");
    if (!normalized) return "";
    if (/^assets\/json\//i.test(normalized)) return normalized;
    if (/\.(json)$/i.test(normalized)) return `assets/json/${normalized}`;
    if (/\.(html?)$/i.test(normalized)) return normalized.replace(/\.(html?)$/i, ".json");
    return `assets/json/${normalized}.json`;
  }

  function toAbsoluteUrl(pathname) {
    return new URL(pathname, window.location.href).toString();
  }

  async function fetchJsonData(fileName) {
    const normalized = normalizeDataFilePath(fileName);
    if (!normalized) throw new Error("Missing project file name.");

    const response = await fetch(toAbsoluteUrl(normalized), { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${normalized}`);
    return await response.json();
  }

  function normalizeData(data = {}) {
    const clone = { ...data };
    if (clone.imageSrc && !clone.location && !clone.folder && !clone.file) {
      clone.location = "local";
      clone.file = clone.imageSrc;
    }
    return clone;
  }

  function renderImageBlock(block, index) {
    const images = Array.isArray(block.images)
      ? block.images
      : (block.src || block.imageSrc ? [block] : []);

    const title = block.title ? `<h2 class="doc-block-title">${escapeHtml(block.title)}</h2>` : "";
    const caption = block.caption ? `<div class="doc-gallery-caption">${escapeHtml(block.caption)}</div>` : "";

    if (images.length > 1) {
      return `
        <section class="doc-section doc-block" data-block-type="gallery">
          ${title}
          <div class="doc-gallery">
            ${images.map((image, imageIndex) => `
              <figure class="doc-gallery-item">
                <img src="${escapeHtml(resolveImageSource(image, block))}" alt="${escapeHtml(image.alt || image.imageAlt || block.title || `Image ${imageIndex + 1}`)}">
                ${(image.caption || block.caption) ? `<figcaption class="doc-gallery-caption">${escapeHtml(image.caption || block.caption || "")}</figcaption>` : ""}
              </figure>
            `).join("")}
          </div>
        </section>
      `;
    }

    const image = images[0] || block;
    const src = resolveImageSource(image, block);
    const alt = image?.alt || image?.imageAlt || block.title || `Image ${index + 1}`;
    const href = String(block.href || block.link || image?.href || image?.link || "").trim();
    const target = String(block.target || image?.target || "").trim() || "_blank";
    const rel = String(block.rel || image?.rel || "").trim() || "noopener noreferrer";

    if (!String(src).trim()) return "";

    return `
      <section class="doc-section doc-block" data-block-type="image">
        ${title}
        ${href ? `
          <a class="doc-image-link" href="${escapeHtml(href)}" target="${escapeHtml(target)}" rel="${escapeHtml(rel)}">
            <div class="doc-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></div>
          </a>
        ` : `
          <div class="doc-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></div>
        `}
        ${caption}
      </section>
    `;
  }

  function renderCodeBlock(block, index) {
    const code = String(block.code || block.text || block.content || "");
    const blockId = `doc-code-${index}`;
    const title = block.title || block.label || "Sample Script";
    const language = block.language ? ` data-language="${escapeHtml(block.language)}"` : "";

    return `
      <section class="doc-section doc-block" data-block-type="code"${language}>
        <div class="doc-pre-toolbar">
          <h2 style="margin:0;">${escapeHtml(title)}</h2>
          <button class="doc-button" type="button" data-copy-target="${blockId}">Copy Code</button>
        </div>
        <pre class="doc-pre"><code id="${blockId}">${escapeHtml(code)}</code></pre>
      </section>
    `;
  }

  function renderTextBlock(block) {
    const href = String(block.href || block.link || "").trim();
    const target = String(block.target || "").trim() || "_blank";
    const rel = String(block.rel || "").trim() || "noopener noreferrer";
    const titleText = block.title || block.heading || "";
    const title = titleText
      ? `
        <h2 class="doc-block-title">
          ${href ? `<a class="doc-text-link" href="${escapeHtml(href)}" target="${escapeHtml(target)}" rel="${escapeHtml(rel)}">${escapeHtml(titleText)}</a>` : escapeHtml(titleText)}
        </h2>
      `
      : "";
    const paragraphs = Array.isArray(block.paragraphs)
      ? block.paragraphs
      : (block.text ? String(block.text).split(/\n\s*\n/g) : []);
    const linkLabel = String(block.linkLabel || block.ctaLabel || "").trim();

    return `
      <section class="doc-section doc-block" data-block-type="text">
        ${title}
        ${paragraphs.map((paragraph) => `<p class="doc-paragraph">${escapeHtml(paragraph)}</p>`).join("")}
        ${href && linkLabel ? `
          <p style="margin:14px 0 0;">
            <a class="doc-button" href="${escapeHtml(href)}" target="${escapeHtml(target)}" rel="${escapeHtml(rel)}">${escapeHtml(linkLabel)}</a>
          </p>
        ` : ""}
      </section>
    `;
  }

  function renderListBlock(block) {
    const items = Array.isArray(block.items) ? block.items : [];
    const title = block.title ? `<h2 class="doc-block-title">${escapeHtml(block.title)}</h2>` : "";
    const lead = block.text ? `<p class="doc-paragraph">${escapeHtml(block.text)}</p>` : "";

    return `
      <section class="doc-section doc-block" data-block-type="list">
        ${title}
        ${lead}
        ${items.length ? `<ul class="doc-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      </section>
    `;
  }

  function renderQuoteBlock(block) {
    const title = block.title ? `<h2 class="doc-block-title">${escapeHtml(block.title)}</h2>` : "";
    return `
      <section class="doc-section doc-block" data-block-type="quote">
        ${title}
        <blockquote class="doc-quote">${escapeHtml(block.text || block.content || "")}</blockquote>
      </section>
    `;
  }

  function renderDividerBlock() {
    return `
      <section class="doc-section doc-block" data-block-type="divider">
        <div class="doc-divider"></div>
      </section>
    `;
  }

  function renderHtmlBlock(block) {
    const title = block.title ? `<h2 class="doc-block-title">${escapeHtml(block.title)}</h2>` : "";
    return `
      <section class="doc-section doc-block" data-block-type="html">
        ${title}
        <div>${block.html || ""}</div>
      </section>
    `;
  }

  function renderGenericBlock(block) {
    const href = String(block.href || block.link || "").trim();
    const target = String(block.target || "").trim() || "_blank";
    const rel = String(block.rel || "").trim() || "noopener noreferrer";
    const title = block.title
      ? `
        <h2 class="doc-block-title">
          ${href ? `<a class="doc-text-link" href="${escapeHtml(href)}" target="${escapeHtml(target)}" rel="${escapeHtml(rel)}">${escapeHtml(block.title)}</a>` : escapeHtml(block.title)}
        </h2>
      `
      : "";
    return `
      <section class="doc-section doc-block" data-block-type="text">
        ${title}
        ${block.text ? `<p class="doc-paragraph">${escapeHtml(block.text)}</p>` : ""}
      </section>
    `;
  }

  function renderBlock(block, index) {
    const type = String(block?.type || block?.kind || "text").trim().toLowerCase();

    if (type === "image") return renderImageBlock(block, index);
    if (type === "code") return renderCodeBlock(block, index);
    if (type === "list") return renderListBlock(block);
    if (type === "quote") return renderQuoteBlock(block);
    if (type === "divider") return renderDividerBlock();
    if (type === "html") return renderHtmlBlock(block);
    if (type === "text" && (block.paragraphs || block.text || block.heading)) return renderTextBlock(block);
    return renderGenericBlock(block);
  }

  function buildFallbackBlocks(data) {
    const blocks = [];

    if (data.prompt) {
      blocks.push({ type: "text", title: "Prompt", text: data.prompt });
    }

    if (Array.isArray(data.images) && data.images.length) {
      blocks.push({ type: "image", title: data.imageTitle || "Images", images: data.images });
    } else if (data.imageSrc || data.imageNote) {
      blocks.push({
        type: "image",
        title: data.imageTitle || "",
        src: data.imageSrc || "",
        imageSrc: data.imageSrc || "",
        location: data.location || data.imageLocation || "local",
        folder: data.folder || data.imageFolder || "",
        file: data.file || data.imageFile || "",
        href: data.imageHref || data.imageLink || "",
        alt: data.imageAlt || data.title || "Project image",
        caption: data.imageCaption || "",
        imageNote: data.imageNote || ""
      });
    }

    if (Array.isArray(data.benefits) && data.benefits.length) {
      blocks.push({ type: "list", title: "Key Benefits", text: data.whatItDoes || "", items: data.benefits });
    } else if (data.whatItDoes) {
      blocks.push({ type: "text", title: "Overview", text: data.whatItDoes });
    }

    if (data.script) {
      blocks.push({ type: "code", title: "Sample Script", code: data.script });
    }

    return blocks;
  }

  function renderDocument(data) {
    const normalized = normalizeData(data || {});
    const metaItems = Array.isArray(normalized.meta) ? normalized.meta : [];
    const explicitBlocks = Array.isArray(normalized.blocks) ? normalized.blocks : [];
    const fallbackBlocks = buildFallbackBlocks(normalized);
    const blocks = explicitBlocks.length ? explicitBlocks : fallbackBlocks;

    document.title = normalized.title || "Project Preview";

    body.innerHTML = `
      <main class="doc-shell">
        <article class="doc">
          <div class="doc-top">
            <div>
              <div class="doc-badge">${escapeHtml(normalized.badge || "File-backed Prompt")}</div>
              <h1 class="doc-title">${escapeHtml(normalized.title || "Project Preview")}</h1>
              ${normalized.subtitle ? `<p class="doc-summary">${escapeHtml(normalized.subtitle)}</p>` : ""}
            </div>
            <div class="doc-actions">
              ${normalized.backHref ? `<a class="doc-button" href="${escapeHtml(normalized.backHref)}" id="doc-back-link">${escapeHtml(normalized.backLabel || "Back to portfolio")}</a>` : ""}
            </div>
          </div>

          <section class="doc-section">
            <p class="doc-eyebrow">${escapeHtml(normalized.eyebrow || "Project overview")}</p>
            <p class="doc-summary">${escapeHtml(normalized.summary || "")}</p>
            ${metaItems.length ? `
              <div class="doc-grid">
                ${metaItems.map((item) => `
                  <div class="doc-meta">
                    <span>${escapeHtml(item.label || "")}</span>
                    <strong>${escapeHtml(item.value || "")}</strong>
                  </div>
                `).join("")}
              </div>
            ` : ""}
          </section>

          ${blocks.map(renderBlock).join("")}
        </article>
      </main>
    `;

    document.querySelectorAll("[data-copy-target]").forEach((copyButton) => {
      const targetId = copyButton.getAttribute("data-copy-target");
      const codeEl = targetId ? document.getElementById(targetId) : null;
      const codeText = codeEl?.textContent || "";

      if (!codeText) return;

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(codeText);
          const label = copyButton.textContent;
          copyButton.textContent = "Copied";
          setTimeout(() => {
            copyButton.textContent = label;
          }, 1400);
        } catch (error) {
          console.error("Copy failed:", error);
        }
      });
    });

    const backLink = document.getElementById("doc-back-link");
    if (backLink && window.self !== window.top) {
      backLink.textContent = normalized.backLabel || "Close preview";
      backLink.addEventListener("click", (event) => {
        event.preventDefault();
        window.parent.postMessage({ type: "project-document-close" }, window.location.origin);
      });
    }
  }

  async function main() {
    const presetData = window.PROJECT_PAGE;
    const fileParam = new URLSearchParams(window.location.search).get(PROJECT_VIEW_QUERY);

    if (presetData && (presetData.title || presetData.blocks || presetData.summary || presetData.script)) {
      renderDocument(presetData);
      return;
    }

    try {
      const data = await fetchJsonData(fileParam || "404.json");
      renderDocument(data);
    } catch (error) {
      console.error(error);
      renderDocument({
        title: "Project Preview",
        summary: "Unable to load the project data file.",
        blocks: [{
          type: "text",
          title: "Project Not Found",
          text: "The project data file could not be loaded."
        }]
      });
    }
  }

  main();
})();
