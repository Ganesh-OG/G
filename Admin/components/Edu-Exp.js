import { getTable } from "./db.js";
import { DB_BASE, SUPABASE_CONFIG } from "./config.js";
import { addEditButton, openEditor } from "./editor-tools.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};

export async function loadEduExp() {

  try {

    const educationRows = await getTable("resume_education");
    const experienceRows = await getTable("resume_experience");

    const data = {
      Education: {},
      Experience: {}
    };

    educationRows.forEach((row, index) => {

      data.Education["E" + index] = {
        "Education-Institution-Name": row.institution,
        Duration: row.duration,
        Feild: row.field,
        CGPA: row.cgpa,
        Percentage: row.percentage
      };

    });

    experienceRows.forEach((row, index) => {

      data.Experience["X" + index] = {
        Role: row.role,
        Duration: row.duration,
        Organisation: row.organisation,
        Experience: row.experience
      };

    });

    const resumeArticle = document.querySelector('article.resume[data-page="resume"]');

    if (!resumeArticle) {
      console.error("Resume article not found.");
      return;
    }

    // -------- Education --------

    const educationSection = document.createElement("section");
    educationSection.classList.add("timeline");

    const educationTitleWrapper = `
    <header>
      <h2 class="h2 article-title">Resume</h2>
    </header>

    <div class="title-wrapper admin-section-header">
      <div class="icon-box">
        <ion-icon name="book-outline"></ion-icon>
      </div>
      <h3 class="h3">Education</h3>
      <button type="button" class="admin-inline-action-btn" data-add-education>Add New</button>
    </div>
    `;

    educationSection.innerHTML = educationTitleWrapper;

    const educationList = document.createElement("ol");
    educationList.classList.add("timeline-list");

    educationRows.forEach((row, index) => {

      const edu = data.Education["E" + index];

      const eduItem = document.createElement("li");
      eduItem.classList.add("timeline-item");

      eduItem.innerHTML = `
        <h4 class="h4 timeline-item-title">${edu["Education-Institution-Name"]}</h4>
        <span>${edu.Duration}</span>

        <p class="timeline-text">
          ${edu.Feild}
          <br>
          ${edu.CGPA ? `CGPA: ${edu.CGPA}` : `Percentage: ${edu.Percentage}`}
        </p>
      `;

      addEditButton(eduItem, {
        table: "resume_education",
        row,
        title: row.institution || "Education",
        fields: [
          { name: "institution", value: row.institution },
          { name: "duration", value: row.duration },
          { name: "field", value: row.field },
          { name: "cgpa", value: row.cgpa },
          { name: "percentage", value: row.percentage }
        ]
      });
      attachDeleteButton(eduItem, () => deleteResumeRow("resume_education", row.id, row.institution || "education"));

      educationList.appendChild(eduItem);

    });

    educationSection.appendChild(educationList);
    resumeArticle.appendChild(educationSection);


    // -------- Experience --------

    const experienceSection = document.createElement("section");
    experienceSection.classList.add("timeline");

    const experienceTitleWrapper = `
      <div class="title-wrapper admin-section-header">
        <div class="icon-box">
          <ion-icon name="book-outline"></ion-icon>
        </div>
        <h3 class="h3">Experience</h3>
        <button type="button" class="admin-inline-action-btn" data-add-experience>Add New</button>
      </div>
    `;

    experienceSection.innerHTML = experienceTitleWrapper;

    const experienceList = document.createElement("ol");
    experienceList.classList.add("timeline-list");

    experienceRows.forEach((row, index) => {

      const exp = data.Experience["X" + index];

      const expItem = document.createElement("li");
      expItem.classList.add("timeline-item");

      expItem.innerHTML = `
        <h4 class="h4 timeline-item-title">${exp.Role}</h4>
        <span>${exp.Duration}</span>

        <p class="timeline-text">
          ${exp.Organisation}
          <br>
          Experience: ${exp.Experience}
        </p>
      `;

      addEditButton(expItem, {
        table: "resume_experience",
        row,
        title: row.role || "Experience",
        fields: [
          { name: "role", value: row.role },
          { name: "duration", value: row.duration },
          { name: "organisation", value: row.organisation },
          { name: "experience", value: row.experience, type: "textarea" }
        ]
      });
      attachDeleteButton(expItem, () => deleteResumeRow("resume_experience", row.id, row.role || "experience"));

      experienceList.appendChild(expItem);

    });

    experienceSection.appendChild(experienceList);
    resumeArticle.appendChild(experienceSection);

    educationSection.querySelector("[data-add-education]")?.addEventListener("click", openAddEducationEditor);
    experienceSection.querySelector("[data-add-experience]")?.addEventListener("click", openAddExperienceEditor);

  }
  catch (error) {

    console.error("Error fetching resume data:", error);

  }

}

function attachDeleteButton(target, onDelete) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-delete-btn";
  button.textContent = "Delete";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete();
  });
  target.appendChild(button);
}

async function deleteResumeRow(table, id, label) {
  const confirmed = window.confirm(`Delete ${label}?`);
  if (!confirmed) return;

  const response = await fetch(`${DB_BASE}/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      ...HEADERS,
      Prefer: "return=minimal"
    }
  });

  if (!response.ok) {
    window.alert(`Failed to delete ${label}.`);
    return;
  }

  window.location.reload();
}

function openAddEducationEditor() {
  openEditor({
    table: "resume_education",
    title: "Add Education",
    method: "POST",
    fields: [
      { name: "institution", value: "" },
      { name: "duration", value: "" },
      { name: "field", value: "" },
      { name: "cgpa", value: "" },
      { name: "percentage", value: "" }
    ],
    transformPayload: ({ payload }) => ({
      institution: payload.institution?.trim(),
      duration: payload.duration?.trim() || null,
      field: payload.field?.trim() || null,
      cgpa: payload.cgpa?.trim() || null,
      percentage: payload.percentage?.trim() || null
    })
  });
}

function openAddExperienceEditor() {
  openEditor({
    table: "resume_experience",
    title: "Add Experience",
    method: "POST",
    fields: [
      { name: "role", value: "" },
      { name: "duration", value: "" },
      { name: "organisation", value: "" },
      { name: "experience", value: "", type: "textarea" }
    ],
    transformPayload: ({ payload }) => ({
      role: payload.role?.trim(),
      duration: payload.duration?.trim() || null,
      organisation: payload.organisation?.trim() || null,
      experience: payload.experience?.trim() || null
    })
  });
}
