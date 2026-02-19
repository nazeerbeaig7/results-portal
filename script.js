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

// Summary fields (make sure these IDs exist in HTML)
const totalCreditsEl = document.getElementById("totalCredits");
const sgpaEl = document.getElementById("sgpa");

// ========== SIMPLE UI HELPERS ==========
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

    // Robust regex for JNTUK-style rows:
    // Htno, Subcode (any), Subname (any text), Internals (number), Grade (A-Z), Credits (number/decimal)
    const rowRegex = /(\d{2}JD[0-9A-Z]{4,})\s+([A-Z0-9]+)\s+(.+?)\s+(\d+)\s+([A-Z]+)\s+(\d+(?:\.\d+)?)/g;

    let match;
    while ((match = rowRegex.exec(text)) !== null) {
      allRows.push({
        ht: String(match[1]).toUpperCase(),
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
    errorDiv.textContent = "Failed to load PDF. Please check the file name/path.";
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
  let totalCredits = 0;
  let totalPoints = 0;

  // Grade to points map
  const gradePoints = {
    "S": 10,
    "A": 9,
    "B": 8,
    "C": 7,
    "D": 6,
    "E": 5,
    "F": 0,
    "ABSENT": 0,
    "COMPLE": 0
  };

  rows.forEach((r, idx) => {
    const grade = String(r.grade || "").trim().toUpperCase();
    const credits = parseFloat(r.credits);

    // Count cleared / failed
    if (grade === "F" || grade === "ABSENT") {
      failed++;
    } else {
      cleared++;
    }

    // Grade points safely
    const gp = Object.prototype.hasOwnProperty.call(gradePoints, grade)
      ? gradePoints[grade]
      : 0;

    // Add credits & points (ignore non-numeric or zero-credit subjects)
    if (!isNaN(credits) && credits > 0) {
      totalCredits += credits;
      totalPoints += credits * gp;
    }

    // Build table row
    const tr = document.createElement("tr");
    tr.style.opacity = 0;
    tr.style.transform = "translateY(6px)";
    tr.innerHTML = `
      <td>${r.subcode}</td>
      <td>${r.subname}</td>
      <td>${r.internals}</td>
      <td>${r.grade}</td>
      <td>${r.credits}</td>
    `;
    tbody.appendChild(tr);

    // Staggered animation
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

  // Update total credits
  if (totalCreditsEl) totalCreditsEl.textContent = totalCredits.toFixed(1);

  // Calculate SGPA
  let sgpa = 0;
  if (totalCredits > 0) {
    sgpa = totalPoints / totalCredits;
  }
  if (sgpaEl) sgpaEl.textContent = sgpa.toFixed(2);

  // Show result
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
