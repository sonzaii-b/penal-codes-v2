const SHEET_ID = "1khzfuDTbQjlkA7b14_GgjE7M73VqT1lnJUJ9_0sL5Fk";
const GID = "1440543688";
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

const $ = id => document.getElementById(id);
const money = n => "$" + n.toLocaleString("en-US");
let codes = [], charges = [], selected = null;

function parseCSV(t) {
  const rows = []; let r = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { r.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; r.push(c); rows.push(r); r = []; c = ""; }
    else c += ch;
  }
  if (c || r.length) { r.push(c); rows.push(r); }
  return rows;
}

function buildCodes(rows) {
  let imp = -1;
  rows.forEach(r => r.forEach((c, i) => { if (/impound/i.test(c) && imp < 0) imp = i; }));
  const out = [];
  for (const r of rows) {
    const cells = r.map(c => c.replace(/\s+/g, " ").trim());
    const ci = cells.findIndex(c => /^\(\d+\)\d+$/.test(c));
    if (ci < 0) continue;
    const rest = cells.map((c, i) => [i, c]).filter(([i, c]) => i > ci && c && i !== imp);
    const [name, cls, desc] = [rest[0]?.[1] || "", rest[1]?.[1] || "", rest[2]?.[1] || ""];
    const pen = (rest.slice(3).find(([, c]) => /\$\s*\d|jail/i.test(c)) || [0, ""])[1];
    const f = pen.match(/\$\s*([\d,]+)/);
    const j = pen.match(/jail[^\d]*(\d+)/i) || pen.match(/(\d+)\s*s?\s*\+/);
    out.push({
      code: cells[ci], name, cls, desc, pen,
      fine: f ? parseInt(f[1].replace(/,/g, ""), 10) : 0,
      jail: j ? parseInt(j[1], 10) : 0,
      impound: imp >= 0 && /^(yes|true|y|x|✓|✔)/i.test(cells[imp]),
      flag: /officer discretion|see note|per escapee/i.test(pen)
    });
  }
  return out;
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function renderResults() {
  const q = $("search").value.trim().toLowerCase(), nq = norm(q);
  const list = codes.filter(c => !q || norm(c.code).includes(nq) || `${c.name} ${c.cls} ${c.desc}`.toLowerCase().includes(q));
  $("results").innerHTML = "";
  if (!list.length) { $("results").innerHTML = '<li class="empty">No codes match your search.</li>'; return; }
  list.forEach(c => {
    const li = document.createElement("li");
    li.tabIndex = 0;
    li.className = selected?.code === c.code ? "sel" : "";
    li.innerHTML = `<span class="code">${c.code}</span><span>${c.name}</span><span class="tag">${c.cls}</span>`;
    const act = e => e.shiftKey ? addCharge(c, false) : select(c);
    li.onclick = act;
    li.onkeydown = e => { if (e.key === "Enter") act(e); };
    $("results").appendChild(li);
  });
}

function select(c) { selected = c; renderResults(); renderPreview(); }

function renderPreview() {
  const c = selected, el = $("previewBody");
  if (!c) { el.innerHTML = '<p class="empty">Select a code to preview it.</p>'; return; }
  el.innerHTML = `
    <p class="pv-title">${c.code} — ${c.name}</p>
    <p class="pv-sub">${c.cls}</p>
    <p>${c.desc}</p>
    <div class="stats">
      <div><b id="pvFine">${c.fine ? money(c.fine) : "None"}</b><span>Fine</span></div>
      <div><b>${c.jail ? c.jail + "s" : "None"}</b><span>Jail time</span></div>
      <div><b>${c.impound ? "Yes" : "No"}</b><span>Impoundment</span></div>
    </div>
    ${c.flag ? `<div class="note">Listed penalty: ${c.pen}. Check the sheet notes before charging.</div>` : ""}
    <label class="dbl"><input type="checkbox" id="dbl"> Double the fine</label>
    <button class="add" id="addBtn" >Add to Charges</button>`;
  $("dbl").onchange = e => { $("pvFine").textContent = c.fine ? money(c.fine * (e.target.checked ? 2 : 1)) : "None"; };
  $("addBtn").onclick = () => { addCharge(c, $("dbl").checked); selected = null; renderResults(); renderPreview(); };
}

function addCharge(c, doubled) {
  charges.push({ ...c, doubled });
  renderAll();
}

function renderCharges() {
  const ul = $("chargeList");
  ul.innerHTML = charges.length ? "" : '<li class="empty">No charges added yet.</li>';
  charges.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="nm">${c.code} — ${c.name}${c.doubled ? " <small>(doubled fine)</small>" : ""}</span>`;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove charge"; x.setAttribute("aria-label", "Remove " + c.name);
    x.onclick = () => { charges.splice(i, 1); renderAll(); };
    li.appendChild(x); ul.appendChild(li);
  });
}

function summaryText() {
  if (!charges.length) return "";
  const fine = charges.reduce((s, c) => s + c.fine * (c.doubled ? 2 : 1), 0);
  const jail = charges.reduce((s, c) => s + c.jail, 0);
  const lines = ["**Charge(s):** " + charges.map(c => `${c.code} — ${c.name}`).join(", ")];
  if (fine) lines.push("*Total Fine:* " + money(fine));
  if (jail) lines.push("*Jail Time:* " + jail + "s");
  if (charges.some(c => c.impound)) lines.push("*Impoundment:* Yes");
  return lines.join("\n");
}

function renderAll() {
  renderCharges(); renderResults(); renderPreview();
  $("summaryText").textContent = summaryText() || "Add a charge to build the summary.";
}

$("copy").onclick = async () => {
  const t = summaryText(); if (!t) return;
  try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); }
  $("copy").textContent = "Copied"; setTimeout(() => $("copy").textContent = "Copy Information", 1500);
};
$("clear").onclick = () => { charges = []; renderAll(); };
$("search").oninput = renderResults;
$("search").onkeydown = e => { if (e.key === "Enter") { const first = $("results").querySelector("li[tabindex]"); if (first) first.click(); } };

fetch(URL_CSV).then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {
  codes = buildCodes(parseCSV(t));
  $("status").textContent = codes.length ? `${codes.length} codes loaded from the sheet` : "No codes found in the sheet.";
  renderAll();
}).catch(() => { $("status").textContent = "Couldn't load the sheet. Make sure it's shared as “Anyone with the link can view.”"; renderAll(); });
