import { getTable } from "./db.js";

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

    <div class="title-wrapper">
      <div class="icon-box">
        <ion-icon name="book-outline"></ion-icon>
      </div>
      <h3 class="h3">Education</h3>
    </div>
    `;

    educationSection.innerHTML = educationTitleWrapper;

    const educationList = document.createElement("ol");
    educationList.classList.add("timeline-list");

    Object.values(data.Education).forEach(edu => {

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

      educationList.appendChild(eduItem);

    });

    educationSection.appendChild(educationList);
    resumeArticle.appendChild(educationSection);


    // -------- Experience --------

    const experienceSection = document.createElement("section");
    experienceSection.classList.add("timeline");

    const experienceTitleWrapper = `
      <div class="title-wrapper">
        <div class="icon-box">
          <ion-icon name="book-outline"></ion-icon>
        </div>
        <h3 class="h3">Experience</h3>
      </div>
    `;

    experienceSection.innerHTML = experienceTitleWrapper;

    const experienceList = document.createElement("ol");
    experienceList.classList.add("timeline-list");

    Object.values(data.Experience).forEach(exp => {

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

      experienceList.appendChild(expItem);

    });

    experienceSection.appendChild(experienceList);
    resumeArticle.appendChild(experienceSection);

  }
  catch (error) {

    console.error("Error fetching resume data:", error);

  }

}