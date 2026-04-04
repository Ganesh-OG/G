import { getTable } from "./db.js";
import { getStorage } from "./config.js";
import { openEditor } from "./editor-tools.js";

export async function loadResumeSoftCopy() {

  try {

    const data = await getTable("resume_softcopy");

    if (!data.length) return;

    const row = data[0];
    const profileRows = await getTable("profile_info");
    const profileName = profileRows[0]?.name?.trim() || "resume";
    const uploadBaseName = `${profileName}-CV`;

    const imageUrl = getStorage("Resume", row.resume_image);
    const pdfUrl = getStorage("Resume", row.resume_pdf);

    const newSection = document.createElement("section");

    newSection.innerHTML = `
      <div class="admin-section-header">
        <h3 class="h3 skills-title">Soft Copy</h3>
        <button type="button" class="admin-inline-action-btn" data-edit-softcopy>Edit Soft Copy</button>
      </div>

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

      <div class="admin-softcopy-meta">
        <div class="admin-softcopy-file">
          <strong>Image</strong>
          <span>${row.resume_image || "No image uploaded"}</span>
        </div>
        <div class="admin-softcopy-file">
          <strong>PDF</strong>
          <span>${row.resume_pdf || "No PDF uploaded"}</span>
        </div>
      </div>
    `;

    const resumeArticle = document.querySelector('article.resume[data-page="resume"]');

    if (resumeArticle) {
      resumeArticle.appendChild(newSection);
      newSection.querySelector("[data-edit-softcopy]")?.addEventListener("click", () => {
        openEditor({
          table: "resume_softcopy",
          row,
          title: "Resume Soft Copy",
          fields: [
            {
              name: "resume_image",
              value: row.resume_image,
              type: "image",
              storageFolder: "Resume",
              uploadBaseName
            },
            {
              name: "resume_pdf",
              value: row.resume_pdf,
              type: "file",
              accept: ".pdf,application/pdf",
              storageFolder: "Resume",
              uploadBaseName
            }
          ]
        });
      });

    }

  }
  catch (error) {

    console.error("Error fetching resume data:", error);

  }

}
