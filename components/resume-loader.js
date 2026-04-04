import { loadEduExp } from "./Edu-Exp.js";
import { loadSkills } from "./technicalskills.js";
import { loadResumeSoftCopy } from "./Resume.js";

document.addEventListener("DOMContentLoaded", async () => {

  try {

    // 1️⃣ Education + Experience
    await loadEduExp();

    // 2️⃣ Technical Skills
    await loadSkills();

    // 3️⃣ Resume Soft Copy
    await loadResumeSoftCopy();

  } 
  catch (error) {

    console.error("Resume page loading failed:", error);

  }

});