import { getTable } from "./db.js";

const TABLE_NAME = "Connect_Subjects";

const DEFAULT_SUBJECTS = [
  { value: "Build-connection", label: "Just Wanted To Connect" },
  { value: "job-offer", label: "Job Offer" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "other", label: "Other" }
];

async function loadSubjects() {
  try {
    const rows = await getTable(TABLE_NAME);
    if (Array.isArray(rows) && rows.length) {
      return rows;
    }
  } catch (error) {
    console.warn(`Failed to load ${TABLE_NAME}; using defaults.`, error);
  }

  return DEFAULT_SUBJECTS;
}

async function renderSubjectOptions() {
  const select = document.querySelector('select[name="subject"]');
  if (!select) return;

  const subjects = await loadSubjects();
  select.innerHTML = `
    <option value="">Select a subject</option>
    ${subjects.map((subject) => `
      <option value="${String(subject.value).replace(/"/g, "&quot;")}">${subject.label}</option>
    `).join("")}
  `;
}

document.addEventListener("DOMContentLoaded", renderSubjectOptions);
