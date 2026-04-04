const STORAGE_KEY = "portfolioContactSubjects";

const DEFAULT_SUBJECTS = [
  { value: "Build-connection", label: "Just Wanted To Connect" },
  { value: "job-offer", label: "Job Offer" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "other", label: "Other" }
];

function loadSubjects() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SUBJECTS;
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SUBJECTS;
  } catch (error) {
    console.error("Failed to load contact subjects:", error);
    return DEFAULT_SUBJECTS;
  }
}

function renderSubjectOptions() {
  const select = document.querySelector('select[name="subject"]');
  if (!select) return;

  const subjects = loadSubjects();
  select.innerHTML = `
    <option value="">Select a subject</option>
    ${subjects.map((subject) => `
      <option value="${String(subject.value).replace(/"/g, "&quot;")}">${subject.label}</option>
    `).join("")}
  `;
}

document.addEventListener("DOMContentLoaded", renderSubjectOptions);
