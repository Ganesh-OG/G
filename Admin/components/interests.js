import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG, getStorage } from "./config.js";
import { addEditButton, openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

async function loadInterests() {

  try {

    const rows = await getTable("interests");

    const serviceList = document.querySelector(".service-list");

    if (!serviceList) {
      console.error("service-list element not found");
      return;
    }

    serviceList.innerHTML = "";

    rows.forEach(interest => {

      const li = document.createElement("li");
      li.className = "service-item";

      const iconBoxDiv = document.createElement("div");
      iconBoxDiv.className = "service-icon-box";

      const imageUrl = getStorage("Interests", interest.image);

      const img = document.createElement("img");

      img.src = imageUrl;
      img.alt = interest.title + " icon";
      img.width = 40;
      img.loading = "eager";
      img.decoding = "async";

      iconBoxDiv.appendChild(img);

      const contentBoxDiv = document.createElement("div");
      contentBoxDiv.className = "service-content-box";

      const h4 = document.createElement("h4");
      h4.className = "h4 service-item-title";
      h4.textContent = interest.title;

      const p = document.createElement("p");
      p.className = "service-item-text";
      p.textContent = interest.message;

      contentBoxDiv.appendChild(h4);
      contentBoxDiv.appendChild(p);

      li.appendChild(iconBoxDiv);
      li.appendChild(contentBoxDiv);
      addEditButton(li, {
        table: "interests",
        row: interest,
        title: interest.title || "Interest",
        onClick: () => {
          openEditor({
            table: "interests",
            row: interest,
            title: interest.title || "Interest",
            fields: [
              { name: "title", value: interest.title },
              { name: "message", value: interest.message, type: "textarea" },
              {
                name: "image",
                value: interest.image,
                type: "image",
                storageFolder: "Interests",
                uploadBaseName: interest.title
              }
            ],
            transformPayload: ({ payload }) => ({
              title: payload.title?.trim(),
              message: payload.message?.trim() || null,
              image: payload.image || null
            })
          });
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-interest-delete-btn";
      deleteButton.setAttribute("aria-label", `Delete ${interest.title || "interest"}`);
      deleteButton.innerHTML = `<ion-icon name="trash-outline"></ion-icon><span>Delete</span>`;
      deleteButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const confirmed = window.confirm(`Delete "${interest.title}"?`);
        if (!confirmed) return;

        const response = await fetch(`${DB_BASE}/interests?id=eq.${encodeURIComponent(interest.id)}`, {
          method: "DELETE",
          headers: {
            ...HEADERS,
            Prefer: "return=minimal"
          }
        });

        if (!response.ok) {
          window.alert("Failed to delete interest.");
          return;
        }

        li.remove();
      });

      li.appendChild(deleteButton);

      serviceList.appendChild(li);

    });

    const addItem = document.createElement("li");
    addItem.className = "service-item service-item-add";
    addItem.innerHTML = `
      <button type="button" class="admin-interest-add-btn" aria-label="Add new personal interest">
        <span class="admin-interest-add-icon">
          <ion-icon name="add-outline"></ion-icon>
        </span>
        <span class="admin-interest-add-label">Add Interest</span>
      </button>
    `;
    addItem.querySelector("button").addEventListener("click", () => {
      openEditor({
        table: "interests",
        title: "Add Interest",
        method: "POST",
        fields: [
          { name: "title", label: "Title" },
          { name: "message", label: "Description", type: "textarea" },
          { name: "image", label: "Icon Image", type: "image", storageFolder: "Interests" }
        ],
        transformPayload: ({ payload }) => ({
          title: payload.title?.trim(),
          message: payload.message?.trim() || null,
          image: payload.image || null
        }),
        submitHandler: async ({ payload }) => {
          const response = await fetch(`${DB_BASE}/interests`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await loadInterests();
          }

          return response;
        }
      });
    });

    serviceList.appendChild(addItem);

  }

  catch (error) {

    console.error("Error loading interests:", error);

  }

}

loadInterests();
