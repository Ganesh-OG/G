import { getTable } from "./db.js";

export async function loadSkills() {

  try {

    const data = await getTable("technical_skills");

    generateSkillsSection(data);

  }
  catch (error) {

    console.error("Error fetching technical skills:", error);

  }

}

function generateSkillsSection(data) {

  const section = document.createElement("section");
  section.className = "skill";

  const title = document.createElement("h3");
  title.className = "h3 skills-title";
  title.textContent = "Technical Skills";

  section.appendChild(title);

  const ul = document.createElement("ul");
  ul.className = "skills-list content-card";

  data.forEach(skill => {

    const li = document.createElement("li");
    li.className = "skills-item";

    const titleWrapper = document.createElement("div");
    titleWrapper.className = "title-wrapper";

    const h5 = document.createElement("h5");
    h5.className = "h5";
    h5.textContent = skill.language;
    titleWrapper.appendChild(h5);

    const dataElem = document.createElement("data");
    dataElem.value = skill.percentage;
    dataElem.textContent = `${skill.percentage}%`;
    titleWrapper.appendChild(dataElem);

    li.appendChild(titleWrapper);

    const progressBg = document.createElement("div");
    progressBg.className = "skill-progress-bg";

    const progressFill = document.createElement("div");
    progressFill.className = "skill-progress-fill";
    progressFill.style.width = `${skill.percentage}%`;

    progressBg.appendChild(progressFill);

    li.appendChild(progressBg);

    ul.appendChild(li);

  });

  section.appendChild(ul);

  const resumeArticle = document.querySelector('article.resume[data-page="resume"]');

  if (resumeArticle) {
    resumeArticle.appendChild(section);
  }

}