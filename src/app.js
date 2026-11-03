// Connects the page to the cleaner. Everything happens in the browser: the file is read with
// FileReader and the clean copy is downloaded from memory, so nothing is uploaded.

import { clean } from "./clean.js";
import { parse, stringify } from "./csv.js";

const PREVIEW_ROWS = 20;
const MAX_BYTES = 50 * 1024 * 1024;

const $ = (id) => document.getElementById(id);
let current = null; // { source, name, delimiter, result }; source is kept so options can be changed

/** Put text into an element safely: file contents are never treated as HTML. */
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function options() {
  const chosen = {};
  for (const box of document.querySelectorAll("[data-option]")) chosen[box.dataset.option] = box.checked;
  return chosen;
}

const plural = (n, word) => `${n.toLocaleString("en-CA")} ${word}${n === 1 ? "" : "s"}`;
const DELIMITER_NAMES = { ",": "commas", ";": "semicolons", "\t": "tabs", "|": "pipes" };

function run(text, name) {
  const { rows, delimiter } = parse(text);
  const result = clean(rows, options());
  current = { source: text, name, delimiter, result };
  render();
}

function render() {
  const { name, delimiter, result } = current;
  $("empty").hidden = true;
  $("output").hidden = false;

  const { before, after } = result;
  $("summary").textContent =
    `${plural(before.rows, "row")} × ${plural(before.columns, "column")} in, ` +
    `${plural(after.rows, "row")} × ${plural(after.columns, "column")} out.`;
  $("fileName").textContent = `${name} · values separated by ${DELIMITER_NAMES[delimiter] ?? delimiter}`;

  const steps = $("steps");
  steps.replaceChildren();
  for (const step of result.steps) {
    const li = el("li", undefined, step.count ? "" : "none");
    li.append(el("span", step.count.toLocaleString("en-CA"), "count"), ` ${step.label}`);
    if (step.detail) li.append(`: ${step.detail}`);
    steps.append(li);
  }

  const columns = $("columns");
  columns.replaceChildren();
  const head = el("tr");
  for (const h of ["Column", "Holds", "Values changed", "Couldn't read", "Notes"]) head.append(el("th", h));
  columns.append(head);
  for (const col of result.columns) {
    const tr = el("tr");
    tr.append(
      el("td", col.name),
      el("td", col.type),
      el("td", col.converted.toLocaleString("en-CA")),
      el("td", col.failed.length.toLocaleString("en-CA")),
      el("td", col.note, "note"),
    );
    columns.append(tr);
  }

  const issues = $("issues");
  issues.replaceChildren();
  if (!result.issues.length) issues.append(el("li", "Nothing. Every value was either fine or fixed."));
  for (const issue of result.issues) {
    const li = el("li");
    li.append(el("span", `Row ${issue.line}: `, "line"), issue.message);
    issues.append(li);
  }

  const preview = $("preview");
  preview.replaceChildren();
  const headRow = el("tr");
  headRow.append(el("th", "Row"));
  for (const h of result.header) headRow.append(el("th", h));
  preview.append(headRow);
  result.rows.slice(0, PREVIEW_ROWS).forEach((row, i) => {
    const tr = el("tr");
    tr.append(el("td", String(result.lines[i]), "blank"));
    for (const value of row) tr.append(value === "" ? el("td", "–", "blank") : el("td", value));
    preview.append(tr);
  });
  $("previewNote").textContent =
    result.rows.length > PREVIEW_ROWS
      ? `First ${PREVIEW_ROWS} of ${plural(result.rows.length, "row")}. "Row" is the line in your original file.`
      : `"Row" is the line in your original file.`;
}

function download() {
  if (!current) return;
  const { header, rows } = current.result;
  const text = stringify([header, ...rows], ",");
  const bom = $("excel").checked ? "﻿" : "";
  const blob = new Blob([bom + text], { type: "text/csv;charset=utf-8" });
  const link = el("a");
  link.href = URL.createObjectURL(blob);
  link.download = current.name.replace(/\.(csv|tsv|txt)$/i, "") + "-clean.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function readFile(file) {
  if (!file) return;
  if (file.size > MAX_BYTES) {
    alert(`That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. This tool handles files up to 50 MB.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => run(String(reader.result), file.name);
  reader.readAsText(file);
}

function start() {
  const drop = $("drop");
  $("file").addEventListener("change", (e) => readFile(e.target.files[0]));
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("file").click();
    }
  });
  for (const type of ["dragenter", "dragover"])
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
  for (const type of ["dragleave", "drop"]) drop.addEventListener(type, () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    readFile(e.dataTransfer.files[0]);
  });

  $("sample").addEventListener("click", async () => {
    const response = await fetch("samples/messy-sales.csv");
    run(await response.text(), "messy-sales.csv");
  });
  $("usePaste").addEventListener("click", () => {
    if ($("paste").value.trim()) run($("paste").value, "pasted.csv");
  });
  // Changing an option re-cleans the same file.
  for (const box of document.querySelectorAll("[data-option]"))
    box.addEventListener("change", () => {
      if (current) run(current.source, current.name);
    });
  $("download").addEventListener("click", download);
}

start();
