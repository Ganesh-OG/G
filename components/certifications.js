import { getTable } from "./db.js";
import { getStorage } from "./config.js";

async function fetchAndUpdateCertifications() {

  try {

    const certifications = await getTable("certifications");

    const article = document.querySelector('article.blog[data-page="blog"]');
    const header = article?.querySelector("header");

    if (!certifications || !article || !header) {
      console.error("Certifications or DOM elements missing");
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "blog-posts-list";

    certifications.forEach(cert => {

      const imageURL = getStorage("Certifications", cert.file_name);

      const li = document.createElement("li");
      li.className = "blog-post-item";

      li.innerHTML = `
        <a href="${cert.cert_link}" target="_blank">

          <figure class="blog-banner-box">
            <img src="${imageURL}" alt="${cert.title}" loading="lazy">
          </figure>

          <div class="blog-content">

            <div class="blog-meta">
              <p class="blog-category">${cert.provider}</p>
              <span class="dot"></span>

              <time datetime="${cert.completion_date}">
                ${cert.completion_date}
              </time>
            </div>

            <h3 class="h3 blog-item-title">${cert.title}</h3>

            <p class="blog-text">
              ${cert.message}
            </p>

          </div>

        </a>
      `;

      ul.appendChild(li);

    });

    article.insertBefore(ul, header.nextSibling);

  } catch (error) {
    console.error("Error fetching certifications:", error);
  }

}

document.addEventListener("DOMContentLoaded", fetchAndUpdateCertifications);