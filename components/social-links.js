import { getTable } from "./db.js";

document.addEventListener("DOMContentLoaded", async () => {

  try {

    const socialData = await getTable("social_links");

    insertSocialLinks(socialData);

  } 
  catch (error) {

    console.error("Error fetching social data:", error);

  }

});


function insertSocialLinks(rows) {

  const socialList = document.querySelector(".social-list");

  if (!socialList) return;

  rows.forEach(row => {

    const platform = row.platform;
    const url = row.url;

    const listItem = document.createElement("li");
    listItem.classList.add("social-item");

    const linkElement = document.createElement("a");
    linkElement.classList.add("social-link");
    linkElement.href = url;
    linkElement.target = "_blank";

    const imgElement = document.createElement("img");
    imgElement.src = `./assets/images/logo/${platform}.png`;
    imgElement.alt = platform;
    imgElement.width = 18;

    linkElement.appendChild(imgElement);
    listItem.appendChild(linkElement);
    socialList.appendChild(listItem);

  });

}