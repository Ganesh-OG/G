import { getTable } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {

  try {

    const rows = await getTable("about");

    if (!rows.length) {
      console.error("No About content found");
      return;
    }

    const aboutContent = rows[0].content;

    const aboutSection = document.querySelector(".about-text p");

    if (aboutSection) {
      aboutSection.innerHTML = aboutContent;
    }

  } catch (error) {
    console.error("Error loading About content:", error);
  }

});