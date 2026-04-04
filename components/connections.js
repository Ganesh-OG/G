import { getTable } from "./db.js";
import { getStorage } from "./config.js";

document.addEventListener("DOMContentLoaded", async function () {

    try {

        const [rows, categoryRows] = await Promise.all([
            getTable("connections"),
            getTable("connection_category")
        ]);

        const filterList = document.getElementById("filter-list");
        const selectList = document.getElementById("select-list");
        const projectList = document.getElementById("project-list");

        if (!rows.length) {
            console.error("No connections found");
            return;
        }

        const isRealConnection = (row) => Boolean(
            row?.name ||
            row?.role ||
            row?.specialisation ||
            row?.working_at ||
            row?.experience ||
            row?.image ||
            row?.email ||
            row?.phone ||
            row?.instagram ||
            row?.facebook ||
            row?.twitter ||
            row?.linkedin ||
            row?.href
        );

        const categories = categoryRows
            .filter((row) => row.category)
            .map((row) => ({
                value: row.category,
                label: row.label || row.category.replaceAll("_", " ")
            }));

        let filterButtons = `
        <li class="filter-item">
            <button class="active" data-filter-btn="all">All</button>
        </li>`;

        let selectItems = `
        <li class="select-item">
            <button data-select-item="all">All</button>
        </li>`;

        let projectItems = "";

        categories.forEach(({ value, label }) => {

            filterButtons += `
            <li class="filter-item">
                <button data-filter-btn="${value}">${label}</button>
            </li>`;

            selectItems += `
            <li class="select-item">
                <button data-select-item="${value}">${label}</button>
            </li>`;

            // Get rows belonging to this category
            const items = rows.filter(row => row.category === value && isRealConnection(row));

            items.forEach(item => {

                const image = getStorage("Connections", item.image);
                const socials = [
                    item.email ? `
                    <a class="connection-social-link" href="mailto:${item.email}" aria-label="Email ${item.name}">
                        <img src="./assets/images/logo/E-mail.png" alt="Email" width="20" height="20">
                    </a>` : "",
                    item.phone ? `
                    <a class="connection-social-link" href="tel:${item.phone}" aria-label="Call ${item.name}">
                        <img src="./assets/images/logo/Phone.png" alt="Phone" width="20" height="20">
                    </a>` : "",
                    item.instagram ? `
                    <a class="connection-social-link" href="${item.instagram}" target="_blank" rel="noopener" aria-label="Instagram ${item.name}">
                        <img src="./assets/images/logo/Instagram.png" alt="Instagram" width="20" height="20">
                    </a>` : "",
                    item.facebook ? `
                    <a class="connection-social-link" href="${item.facebook}" target="_blank" rel="noopener" aria-label="Facebook ${item.name}">
                        <img src="./assets/images/logo/Facebook.png" alt="Facebook" width="20" height="20">
                    </a>` : "",
                    item.twitter ? `
                    <a class="connection-social-link" href="${item.twitter}" target="_blank" rel="noopener" aria-label="X ${item.name}">
                        <img src="./assets/images/logo/X-Corp.png" alt="X" width="20" height="20">
                    </a>` : "",
                    item.linkedin ? `
                    <a class="connection-social-link" href="${item.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn ${item.name}">
                        <img src="./assets/images/logo/Linked-In.png" alt="LinkedIn" width="20" height="20">
                    </a>` : "",
                    item.href ? `
                    <a class="connection-social-link" href="${item.href}" target="_blank" rel="noopener" aria-label="Website ${item.name}">
                        <ion-icon name="globe-outline"></ion-icon>
                    </a>` : ""
                ].filter(Boolean).join("");

                projectItems += `
                <li class="project-item connection-card-item" data-filter-item data-category="${value}">
                    <div class="connection-card">
                        <figure class="connection-card__image-wrap">
                            <img class="connection-card__image" src="${image}" alt="${item.name}" loading="lazy">
                        </figure>

                        <div class="connection-card__body">
                            <h3 class="connection-card__name">${item.name || ""}</h3>
                            ${item.role ? `<p class="connection-card__role">${item.role}</p>` : ""}
                            ${item.specialisation ? `
                            <p class="connection-card__meta">
                                <strong>Specialisation:</strong>
                                <span>${item.specialisation}</span>
                            </p>` : ""}
                            ${item.working_at ? `
                            <p class="connection-card__meta">
                                <strong>Work:</strong>
                                <span>${item.working_at}</span>
                            </p>` : ""}
                            ${item.experience ? `
                            <p class="connection-card__meta">
                                <strong>Experience:</strong>
                                <span>${item.experience}</span>
                            </p>` : ""}
                            ${socials ? `<div class="connection-card__socials">${socials}</div>` : ""}
                        </div>
                    </div>
                </li>`;

            });

        });

        filterList.innerHTML = filterButtons;
        selectList.innerHTML = selectItems;
        projectList.innerHTML = projectItems;

        // Show all by default
        document.querySelectorAll(".project-item").forEach(item => {
            item.style.display = "block";
        });

        // Filter buttons
        const filterButtonsElements = document.querySelectorAll("[data-filter-btn]");

        filterButtonsElements.forEach(button => {

            button.addEventListener("click", function () {

                const category = this.getAttribute("data-filter-btn");

                document.querySelectorAll("[data-filter-item]").forEach(item => {

                    if (category === "all" || item.getAttribute("data-category") === category) {
                        item.style.display = "block";
                    } else {
                        item.style.display = "none";
                    }

                });

                filterButtonsElements.forEach(btn => btn.classList.remove("active"));
                this.classList.add("active");

            });

        });

        // Dropdown select filter
        const selectButtons = document.querySelectorAll("[data-select-item]");
        const dropdownMenu = document.getElementById("select-list");

        selectButtons.forEach(button => {

            button.addEventListener("click", function () {

                const category = this.getAttribute("data-select-item");

                const filterButton = document.querySelector(`[data-filter-btn="${category}"]`);

                if (filterButton) {
                    filterButton.click();
                }

                document.querySelector("[data-select-value]").textContent = this.textContent;

                dropdownMenu.style.display = "none";

            });

        });

    } catch (error) {

        console.error("Error fetching connections:", error);

    }

});
