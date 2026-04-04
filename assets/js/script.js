'use strict';



// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// testimonials variables
const testimonialsItem = document.querySelectorAll("[data-testimonials-item]");
const modalContainer = document.querySelector("[data-modal-container]");
const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
const overlay = document.querySelector("[data-overlay]");

// modal variable
const modalImg = document.querySelector("[data-modal-img]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalText = document.querySelector("[data-modal-text]");

// modal toggle function
const testimonialsModalFunc = function () {
  modalContainer.classList.toggle("active");
  overlay.classList.toggle("active");
}

// add click event to all modal items
for (let i = 0; i < testimonialsItem.length; i++) {

  testimonialsItem[i].addEventListener("click", function () {

    modalImg.src = this.querySelector("[data-testimonials-avatar]").src;
    modalImg.alt = this.querySelector("[data-testimonials-avatar]").alt;
    modalTitle.innerHTML = this.querySelector("[data-testimonials-title]").innerHTML;
    modalText.innerHTML = this.querySelector("[data-testimonials-text]").innerHTML;

    testimonialsModalFunc();

  });

}

// add click event to modal close button
modalCloseBtn.addEventListener("click", testimonialsModalFunc);
overlay.addEventListener("click", testimonialsModalFunc);


//mark
// custom select variables
(function() {
  // Function to toggle visibility of the select dropdown
  const toggleDropdown = () => {
    const selectButton = document.querySelector("[data-select]");
    const selectList = document.getElementById('select-list');

    if (selectButton.classList.contains('active')) {
      selectButton.classList.remove('active');
      selectList.style.display = 'none';
    } else {
      selectButton.classList.add('active');
      selectList.style.display = 'block';
    }
  };

  // Function to hide the dropdown
  const hideDropdown = () => {
    const selectButton = document.querySelector("[data-select]");
    const selectList = document.getElementById('select-list');
    selectButton.classList.remove('active');
    selectList.style.display = 'none';
  };

  // Function to filter project items based on category
  const filterProjects = (category) => {
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
      if (category === "all" || item.getAttribute('data-category') === category) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
    hideDropdown();  // Hide dropdown after selection
  };

  // Initialize event listeners
  document.addEventListener('DOMContentLoaded', () => {
    const selectButton = document.querySelector("[data-select]");
    const selectItems = document.querySelectorAll("[data-select-item]");
    const selectValue = document.querySelector("[data-select-value]");
    const filterButtons = document.querySelectorAll("[data-filter-btn]");

    // Handle select dropdown click
    selectButton.addEventListener("click", (e) => {
      e.stopPropagation();  // Prevent event bubbling to the document
      toggleDropdown();
    });

    // Handle clicks outside the dropdown to close it
    document.addEventListener('click', () => {
      hideDropdown();
    });

    // Handle select items click
    selectItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();  // Prevent event bubbling to the document
        const selectedValue = item.getAttribute('data-select-item');
        selectValue.innerText = item.innerText;
        filterProjects(selectedValue);
      });
    });

    // Handle filter button click
    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        const selectedValue = button.getAttribute('data-filter-btn');
        selectValue.innerText = button.innerText;
        filterProjects(selectedValue);

        // Update active button
        filterButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
      });
    });
  });
})();




// Contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// Add event listener to form button
formBtn.addEventListener("click", function (event) {
  // Check if phone number input is empty
  const phoneNumberInput = document.querySelector("[name='number']");
  const phoneNumber = phoneNumberInput.value.trim();
  
  if (!phoneNumber) {
    // If phone number is not provided, ask for confirmation
    const confirmation = confirm("Phone number is not provided. Are you sure you want to send the message without a phone number?");
    
    if (!confirmation) {
      event.preventDefault(); // Prevent form submission
    }
  }
});




// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// add event to all nav link
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function () {
    for (let j = 0; j < pages.length; j++) {
      if (this.innerHTML.toLowerCase() === "certifications") {
        if (pages[j].dataset.page === "blog") {
          pages[j].classList.add("active");
          navigationLinks[j].classList.add("active");
          window.scrollTo(0, 0);
        } else {
          pages[j].classList.remove("active");
          navigationLinks[j].classList.remove("active");
        }
      } else if (this.innerHTML.toLowerCase() === "connections" && pages[j].dataset.page === "portfolio") {
        pages[j].classList.add("active");
        navigationLinks[j].classList.add("active");
        window.scrollTo(0, 0);
      } else if (this.innerHTML.toLowerCase() === pages[j].dataset.page) {
        pages[j].classList.add("active");
        navigationLinks[j].classList.add("active");
        window.scrollTo(0, 0);
      } else {
        pages[j].classList.remove("active");
        navigationLinks[j].classList.remove("active");
      }
    }
  });
}

