// ========== PDF.JS SETUP ==========
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ========== GLOBAL STATE ==========
let allRows = [];
let isLoading = false;

// ========== UI ELEMENTS ==========
const btn = document.getElementById("btn");
const hallInput = document.getElementById("hall");
const errorDiv = document.getElementById("error");
const wrap = document.getElementById("resultWrap");
const tbody = document.getElementById("tbody");
const htShow = document.getElementById("htShow");
const statusBadge = document.getElementById("statusBadge");
const clearedCountEl = document.getElementById("clearedCount");
const failedCountEl = document.getElementById("failedCount");
const printBtn = document.getElementById("printBtn");
const pdfSelect = document.getElementById("pdfSelect");

// ========== SIMPLE ANIMATION HELPERS ==========
function showLoading() {
  btn.disabled = true;
  btn.textContent = "Loading PDF...";
}

function hideLoading() {
  btn.disabled = false;
  btn.textContent = "Search";
}

function fadeIn(el) {
  el.style.opacity = 0;
  el.classList.remove("hidden");
  el.style.transition = "opacity 0.4s ease";
  requestAnimationFrame(() => {
    el.style.opacity = 1;
  });
}

function shake(el) {
  el.animate(
    [
      { transform: "translateX(0px)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0px)" }
    ],
    { duration: 300 }
  );
}

// ========== LOAD SELECTED PDF ==========
async function loadSelectedPDF() {
  if (isLoading) return;
  isLoading = true;

  showLoading();
  allRows = [];

  const url = pdfSelect.value;

  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(it => it.str).join(" ");
      text += strings + "\n";
    }

    // Regex based on your JNTUK result format:
    // Htno (e.g., 24JD1A0201)
    // Subcode (e.g., R2321012)
    // Subname (text)
    // Internals (number)
    // Grade (F, D, E, ABSENT, COMPLE, S, etc.)
    // Credits (number or decimal)
  // Robust regex for JNTUK-style rows (handles AI, Entrepreneurship, COMPLE, ABSENT, labs, etc.)
const rowRegex = /(\d{2}JD[0-9A-Z]{4,})\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([A-Z]+)\s+(\d+(?:\.\d+)?)/g;


    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      allRows.push({
        ht: match[1].toUpperCase(),
        subcode: match[2],
        subname: match[3].trim(),
        internals: match[4],
        grade: match[5],
        credits: match[6]
      });
    }

    console.log("Loaded:", url, "Rows:", allRows.length);
  } catch (err) {
    console.error("PDF load error:", err);
    errorDiv.textContent = "Failed to load PDF. Please check the file.";
    errorDiv.classList.remove("hidden");
    shake(errorDiv);
  } finally {
    hideLoading();
    isLoading = false;
  }
}

// ========== SEARCH LOGIC ==========
function search() {
  const hall = hallInput.value.trim().toUpperCase();

  errorDiv.classList.add("hidden");
  wrap.classList.add("hidden");
  tbody.innerHTML = "";

  if (!hall) {
    errorDiv.textContent = "Please enter Hall Ticket Number.";
    errorDiv.classList.remove("hidden");
    shake(errorDiv);
    return;
  }

  if (allRows.length === 0) {
    errorDiv.textContent = "PDF is still loading. Please wait...";
    errorDiv.classList.remove("hidden");
    shake(errorDiv);
    return;
  }

  const rows = allRows.filter(r => r.ht === hall);

  if (rows.length === 0) {
    errorDiv.textContent = "Result not found. Please check the Hall Ticket Number.";
    errorDiv.classList.remove("hidden");
    shake(errorDiv);
    return;
  }

  htShow.textContent = hall;

  let cleared = 0;
  let failed = 0;

  rows.forEach((r, idx) => {
    // Count cleared / failed
    if (r.grade === "F" || r.grade === "ABSENT") {
      failed++;
    } else {
      cleared++;
    }

    const tr = document.createElement("tr");
    tr.style.opacity = 0;
    tr.innerHTML = `
      <td>${r.subcode}</td>
      <td>${r.subname}</td>
      <td>${r.internals}</td>
      <td>${r.grade}</td>
      <td>${r.credits}</td>
    `;
    tbody.appendChild(tr);

    // Staggered row animation
    setTimeout(() => {
      tr.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      tr.style.opacity = 1;
      tr.style.transform = "translateY(0)";
    }, idx * 60);
  });

  // Update counts
  clearedCountEl.textContent = cleared;
  failedCountEl.textContent = failed;

  // Overall status
  if (failed > 0) {
    statusBadge.textContent = "FAIL";
    statusBadge.className = "badge fail";
  } else {
    statusBadge.textContent = "PASS";
    statusBadge.className = "badge pass";
  }

  fadeIn(wrap);
}

// ========== EVENTS ==========
btn.addEventListener("click", search);
printBtn.addEventListener("click", () => window.print());
pdfSelect.addEventListener("change", () => {
  // Clear old result on PDF change
  wrap.classList.add("hidden");
  errorDiv.classList.add("hidden");
  tbody.innerHTML = "";
  loadSelectedPDF();
});

// Load first PDF on page load
window.addEventListener("load", loadSelectedPDF);

// Allow Enter key to search
hallInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});
