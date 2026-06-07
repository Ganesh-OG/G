import { getTable } from "./db.js";
import { getStorage } from "./config.js";

const DEFAULT_SOCIAL_LINKS = [
  { platform: "Git", icon: "g" },
  { platform: "Facebook", icon: "Facebook.png" },
  { platform: "Instagram", icon: "Instagram.png" },
  { platform: "Linked-In", icon: "Linked-In.png" },
  { platform: "X-Corp", icon: "X-Corp.png" }
];

const DEFAULT_ICON_FILENAMES = new Set(DEFAULT_SOCIAL_LINKS.map((item) => item.icon));

document.addEventListener("DOMContentLoaded", async () => {

  try {

    const socialData = await getTable("social_links");

    insertSocialLinks(socialData);

  } 
  catch (error) {

    console.error("Error fetching social data:", error);

  }

});

function getDefaultPlatformConfig(platform) {
  return DEFAULT_SOCIAL_LINKS.find((item) => item.platform === platform);
}

function getIconFilename(row) {
  return row.icon || getDefaultPlatformConfig(row.platform)?.icon || `${row.platform}.png`;
}

function resolveSocialIconUrl(iconFilename) {
  if (!iconFilename) return "";
  if (DEFAULT_ICON_FILENAMES.has(iconFilename)) {
    return `./assets/images/logo/${iconFilename}`;
  }
  return getStorage("logo", iconFilename);
}

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
    imgElement.src = resolveSocialIconUrl(getIconFilename(row));
    imgElement.alt = platform;
    imgElement.width = 18;

    linkElement.appendChild(imgElement);
    listItem.appendChild(linkElement);
    socialList.appendChild(listItem);

  });

}
