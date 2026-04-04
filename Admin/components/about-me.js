import { getTable } from "./db.js";
import { addEditButton } from "./editor-tools.js";

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
      addEditButton(aboutSection.parentElement, {
        table: "about",
        row: rows[0],
        title: "About Content",
        fields: [
          { name: "content", value: rows[0].content, type: "textarea" }
        ]
      });
    }

  } catch (error) {
    console.error("Error loading About content:", error);
  }

});
