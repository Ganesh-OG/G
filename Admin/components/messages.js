import { DB_BASE, SUPABASE_CONFIG } from "./config.js";

const TABLE_NAME = "response";
const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

let messageRows = [];
let activeMessageId = null;
let replyPanelVisibleFor = null;

document.addEventListener("DOMContentLoaded", () => {
  const refreshButton = document.getElementById("admin-messages-refresh");
  refreshButton?.addEventListener("click", loadMessages);
  loadMessages();
});

async function loadMessages() {
  const list = document.getElementById("admin-messages-list");
  const detail = document.getElementById("admin-messages-detail");
  if (!list || !detail) return;

  list.innerHTML = `<div class="admin-messages-empty">Loading messages...</div>`;

  try {
    const response = await fetch(
      `${DB_BASE}/${TABLE_NAME}?select=*&order=created_at.desc`,
      { headers: HEADERS }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    messageRows = await response.json();
    renderMessageList();

    if (messageRows.length) {
      const nextId = messageRows.some((row) => String(row.id) === String(activeMessageId))
        ? activeMessageId
        : messageRows[0].id;
      openMessage(nextId, { markRead: false });
    } else {
      activeMessageId = null;
      detail.innerHTML = `<div class="admin-messages-empty">No messages yet.</div>`;
    }
  } catch (error) {
    list.innerHTML = `<div class="admin-messages-empty">Failed to load messages.</div>`;
    detail.innerHTML = `<div class="admin-messages-empty">Failed to load messages.</div>`;
    console.error("[MESSAGES] Failed to load messages:", error);
  }
}

function renderMessageList() {
  const list = document.getElementById("admin-messages-list");
  if (!list) return;

  if (!messageRows.length) {
    list.innerHTML = `<div class="admin-messages-empty">No messages yet.</div>`;
    return;
  }

  list.innerHTML = "";

  messageRows.forEach((row) => {
    const button = document.createElement("div");
    button.className = "admin-message-item";
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.setAttribute("aria-expanded", String(String(row.id) === String(activeMessageId)));
    if (String(row.id) === String(activeMessageId)) {
      button.classList.add("active");
    }
    if ((row.status || "").toLowerCase() !== "read") {
      button.classList.add("is-unread");
    }

    const createdAt = formatDate(row.created_at);
    button.innerHTML = `
      <div class="admin-message-item-top">
        <strong>${escapeHtml(row.name || "Unknown")}</strong>
        <span class="admin-message-chevron" aria-hidden="true">
          <ion-icon name="${String(row.id) === String(activeMessageId) ? "chevron-up-outline" : "chevron-down-outline"}"></ion-icon>
        </span>
      </div>
      <div class="admin-message-item-meta">
        <span>${escapeHtml(createdAt)}</span>
        <span>${escapeHtml(row.subject || "No subject")}</span>
        <span>${escapeHtml(row.email || "No email")}</span>
      </div>
      <p>${escapeHtml(truncate(row.message || "", 90))}</p>
      ${String(row.id) === String(activeMessageId) ? `
        <div class="admin-message-inline-detail">
          ${buildMessageDetailMarkup(row)}
        </div>
      ` : ""}
    `;

    button.addEventListener("click", () => {
      toggleMessage(row.id);
    });

    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMessage(row.id);
      }
    });

    if (String(row.id) === String(activeMessageId)) {
      bindMessageActions(button, row);
    }

    list.appendChild(button);
  });
}

async function openMessage(id, { markRead = true } = {}) {
  const detail = document.getElementById("admin-messages-detail");
  const row = messageRows.find((item) => String(item.id) === String(id));
  if (!detail || !row) return;

  activeMessageId = row.id;
  renderMessageList();

  detail.innerHTML = `
    ${buildMessageDetailMarkup(row)}
  `;

  bindMessageActions(detail, row);

  if (markRead && (row.status || "").toLowerCase() !== "read") {
    await updateMessage(row.id, { status: "read" }, { silentDetailRefresh: true });
  }
}

async function toggleMobileMessage(id) {
  const isSame = String(activeMessageId) === String(id);
  activeMessageId = isSame ? null : id;
  replyPanelVisibleFor = isSame ? null : (replyPanelVisibleFor === id ? id : null);
  renderMessageList();

  const row = messageRows.find((item) => String(item.id) === String(id));
  if (!isSame && row && (row.status || "").toLowerCase() !== "read") {
    await updateMessage(id, { status: "read" }, { silentDetailRefresh: true });
  }
}

async function updateMessage(id, patch, { silentDetailRefresh = false } = {}) {
  try {
    const response = await fetch(`${DB_BASE}/${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        ...HEADERS,
        Prefer: "return=representation"
      },
      body: JSON.stringify(patch)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const updatedRows = await response.json();
    const updated = updatedRows[0];
    messageRows = messageRows.map((row) => String(row.id) === String(id) ? updated : row);
    renderMessageList();

    if (!silentDetailRefresh) {
      renderMessageList();
    }
  } catch (error) {
    console.error("[MESSAGES] Failed to update message:", error);
    window.alert("Failed to update message.");
  }
}

async function deleteMessage(id) {
  try {
    const response = await fetch(`${DB_BASE}/${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        ...HEADERS,
        Prefer: "return=minimal"
      }
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    messageRows = messageRows.filter((row) => String(row.id) !== String(id));
    activeMessageId = null;
    renderMessageList();

    if (messageRows.length) {
      openMessage(messageRows[0].id, { markRead: false });
    } else {
      const detail = document.getElementById("admin-messages-detail");
      if (detail) {
        detail.innerHTML = `<div class="admin-messages-empty">No messages yet.</div>`;
      }
    }
  } catch (error) {
    console.error("[MESSAGES] Failed to delete message:", error);
    window.alert("Failed to delete message.");
  }
}

function buildReplyHref(row) {
  const email = encodeURIComponent(row.email || "");
  const subject = encodeURIComponent(`Re: ${row.subject || "Portfolio message"}`);
  return `mailto:${email}?subject=${subject}`;
}

function buildMessageDetailMarkup(row) {
  return `
    <div class="admin-message-detail-card">
      <div class="admin-message-detail-header">
        <div>
          <p class="admin-social-manager-kicker">Response</p>
          <h3>${escapeHtml(row.subject || "No subject")}</h3>
        </div>
        <span class="admin-message-status ${(row.status || "").toLowerCase() === "read" ? "is-read" : "is-unread"}">
          ${escapeHtml(row.status || "new")}
        </span>
      </div>

      <div class="admin-message-grid">
        <div><strong>Name</strong><span>${escapeHtml(row.name || "-")}</span></div>
        <div><strong>Email</strong><span>${buildEmailLink(row.email)}</span></div>
        <div><strong>Phone</strong><span>${buildPhoneLink(row.phone)}</span></div>
        <div><strong>Received</strong><span>${escapeHtml(formatDate(row.created_at))}</span></div>
      </div>

      <div class="admin-message-body">
        <strong>Message</strong>
        <p>${escapeHtml(row.message || "-").replace(/\n/g, "<br>")}</p>
      </div>

      <div class="admin-message-actions">
        <button type="button" class="admin-social-manager-btn" data-message-action="toggle-read">
          ${(row.status || "").toLowerCase() === "read" ? "Mark Unread" : "Mark Read"}
        </button>
        <button type="button" class="admin-social-manager-btn" data-message-action="reply">Reply</button>
        <button type="button" class="admin-social-manager-btn danger" data-message-action="delete">Delete</button>
      </div>
      <div class="admin-message-reply-panel${replyPanelVisibleFor === row.id ? " active" : ""}">
        <strong>Reply With</strong>
        <div class="admin-message-reply-actions">
          <a class="admin-social-manager-btn" href="${buildReplyHref(row)}" target="_blank" rel="noopener">Email</a>
          <a class="admin-social-manager-btn${row.phone ? "" : " is-disabled"}" href="${buildCallHref(row.phone)}"${row.phone ? "" : ` aria-disabled="true" tabindex="-1"`}>Call</a>
          <a class="admin-social-manager-btn${row.phone ? "" : " is-disabled"}" href="${buildWhatsappHref(row)}"${row.phone ? ` target="_blank" rel="noopener"` : ` aria-disabled="true" tabindex="-1"`}>WhatsApp</a>
        </div>
      </div>
    </div>
  `;
}

function bindMessageActions(container, row) {
  container.querySelector('[data-message-action="toggle-read"]')?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const nextStatus = (row.status || "").toLowerCase() === "read" ? null : "read";
    await updateMessage(row.id, { status: nextStatus });
  });

  container.querySelector('[data-message-action="reply"]')?.addEventListener("click", (event) => {
    event.stopPropagation();
    replyPanelVisibleFor = replyPanelVisibleFor === row.id ? null : row.id;
    renderMessageList();
  });

  container.querySelector('[data-message-action="delete"]')?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete this message?\n\nFrom: ${row.name || "Unknown"}\nSubject: ${row.subject || "No subject"}`
    );
    if (!confirmed) return;
    await deleteMessage(row.id);
  });
}

function buildCallHref(phone) {
  const normalized = normalizePhone(phone);
  return normalized ? `tel:${normalized}` : "#";
}

function buildWhatsappHref(row) {
  const normalized = normalizePhone(row.phone);
  if (!normalized) return "#";
  const text = encodeURIComponent(`Hi ${row.name || ""}, regarding your message: ${row.subject || "Portfolio message"}`);
  return `https://wa.me/${normalized.replace(/^\+/, "")}?text=${text}`;
}

function buildEmailLink(email) {
  if (!email) return "-";
  const safeEmail = escapeHtml(email);
  return `<a class="admin-message-link" href="mailto:${encodeURIComponent(email)}" target="_blank" rel="noopener">${safeEmail}</a>`;
}

function buildPhoneLink(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "-";
  const safePhone = escapeHtml(phone);
  return `<a class="admin-message-link" href="tel:${normalized}">${safePhone}</a>`;
}

function normalizePhone(phone) {
  const cleaned = String(phone || "").trim().replace(/[^\d+]/g, "");
  return cleaned || "";
}

async function toggleMessage(id) {
  const isSame = String(activeMessageId) === String(id);
  activeMessageId = isSame ? null : id;
  replyPanelVisibleFor = isSame ? null : (replyPanelVisibleFor === id ? id : null);
  renderMessageList();

  const row = messageRows.find((item) => String(item.id) === String(id));
  if (!isSame && row && (row.status || "").toLowerCase() !== "read") {
    await updateMessage(id, { status: "read" }, { silentDetailRefresh: true });
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function truncate(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
