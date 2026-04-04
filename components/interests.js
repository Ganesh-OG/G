import { getTable } from "./db.js";
import { getStorage } from "./config.js";

async function loadInterests() {

  try {

    const rows = await getTable("interests");

    const serviceList = document.querySelector(".service-list");

    if (!serviceList) {
      console.error("service-list element not found");
      return;
    }

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

      serviceList.appendChild(li);

    });

  }

  catch (error) {

    console.error("Error loading interests:", error);

  }

}

loadInterests();