import { getTable } from "./db.js";
import { getStorage } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {

  try {

    const rows = await getTable("profile_info");

    if (!rows.length) {
      console.error("Profile info not found");
      return;
    }

    const data = rows[0];

    // Name
    const nameElement = document.querySelector(".name");
    if (nameElement) {
      nameElement.textContent = data.name;
      nameElement.setAttribute("title", data.name);
    }

    // Role (supports <br> from database)
    const title = document.querySelector(".title");
    if (title && data.role) {
      title.innerHTML = data.role;
    }

    // Email
    const emailLink = document.querySelector('.contact-link[href^="mailto"]');
    if (emailLink) {
      emailLink.textContent = data.email;
      emailLink.setAttribute("href", `mailto:${data.email}`);
    }

    // Phone
    const phoneLink = document.querySelector('.contact-link[href^="tel"]');
    if (phoneLink) {
      phoneLink.textContent = data.phone;
      phoneLink.setAttribute("href", `tel:+${data.country_code}${data.phone}`);
    }

    // DOB
    const birthdayTime = document.querySelector("time[datetime]");
    if (birthdayTime) {
      birthdayTime.textContent = new Date(data.dob).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      birthdayTime.setAttribute("datetime", data.dob);
    }

    // Location
    const address = document.querySelector("address");
    if (address) {
      address.textContent = data.location;
    }

    // Profile Image from Supabase Storage
    const profileImageUrl = getStorage("Profile", data.profile_image);

    const profileImage = document.querySelector(".avatar-box img");
    if (profileImage) {
      profileImage.src = profileImageUrl;
      profileImage.alt = "Profile Image";
      profileImage.style.borderRadius = "15px";
    }

  } catch (error) {
    console.error("Error fetching profile info:", error);
  }

});
