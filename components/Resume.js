import { getTable } from "./db.js";
import { getStorage } from "./config.js";

export async function loadResumeSoftCopy() {

  try {

    const data = await getTable("resume_softcopy");

    if (!data.length) return;

    const row = data[0];

    const imageUrl = getStorage("Resume", row.resume_image);
    const pdfUrl = getStorage("Resume", row.resume_pdf);

    const newSection = document.createElement("section");

    newSection.innerHTML = `
      <h3 class="h3 skills-title">Soft Copy</h3>

      <li class="project-item active">

        <a href="${pdfUrl}" target="_blank">

          <figure class="project-img">

            <div class="project-item-icon-box">
              <ion-icon name="eye-outline"></ion-icon>
            </div>

            <img src="${imageUrl}" alt="Resume Image" loading="lazy">

          </figure>

        </a>

      </li>
    `;

    const resumeArticle = document.querySelector('article.resume[data-page="resume"]');

    if (resumeArticle) {

      resumeArticle.appendChild(newSection);

    }

  }
  catch (error) {

    console.error("Error fetching resume data:", error);

  }

}