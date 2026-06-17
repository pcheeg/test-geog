/* GeoRank Puzzle Generator Tester */

const START_DATE_UTC = Date.UTC(2026, 5, 17, 0, 0, 0); // 17 June 2026 00:00 GMT
const DAY_MS = 86400000;

const GOOD_REFERENCE_CAPITALS = new Set([
  "London","Paris","Madrid","Rome","Athens","Cairo","Nairobi","Ottawa","Washington, D.C.","Washington",
  "Mexico City","Buenos Aires","Brasília","Tokyo","Bangkok","Canberra","Berlin","Vienna","Warsaw",
  "Lima","Santiago","Ankara","Jakarta","New Delhi","Seoul","Rabat","Tunis","Dublin"
]);

const HARD_REFERENCE_CAPITALS = new Set([
  "Astana","Tashkent","Ulaanbaatar","Dushanbe","Yerevan","Bishkek","Ljubljana","Skopje","Tbilisi",
  "Kigali","Baku","Doha","Muscat","Amman","Tirana","Chisinau","Vilnius","Riga","Tallinn",
  "Hanoi","Vientiane","Phnom Penh","Kathmandu","Thimphu","Asunción","Montevideo","Quito"
]);

const WEAK_REFERENCE_CAPITALS = new Set([
  "Reykjavik","Wellington","Oslo","Suva","Ngerulmud","Funafuti","Majuro","Tarawa","Palikir","Nukuʻalofa"
]);

const FLAG_FORBIDDEN_PAIRS = [
  ["Chad", "Romania"],
  ["Monaco", "Indonesia"],
  ["Netherlands", "Luxembourg"]
];

const FLAG_SIMILAR_GROUPS = [
  ["Jordan", "Iraq", "Sudan", "Syria", "Palestine"],
  ["Iran", "Tajikistan", "Hungary"],
  ["Romania", "Moldova", "Andorra"],
  ["Senegal", "Mali", "Guinea", "Cameroon"],
  ["Ireland", "Ivory Coast"],
  ["Poland", "Monaco", "Indonesia"],
  ["Norway", "Iceland", "Faroe Islands", "Finland", "Sweden", "Denmark"].filter(Boolean)
];

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sample(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(x => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function toRad(deg) { return deg * Math.PI / 180; }
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function fmtKm(v) { return `${Math.round(v).toLocaleString()} km`; }
function fmtPop(v) { return v >= 1000000 ? `${(v/1000000).toFixed(v>=10000000?1:2)}m` : v.toLocaleString(); }
function alphabetValue(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function alphabeticalGap(a, b) {
  const A = alphabetValue(a), B = alphabetValue(b);
  const n = Math.max(A.length, B.length, 1);
  for (let i=0; i<n; i++) {
    const ca = A.charCodeAt(i) || 96;
    const cb = B.charCodeAt(i) || 96;
    if (ca !== cb) return Math.abs(ca - cb);
  }
  return 0;
}
function dateForPuzzleNo(n) {
  return new Date(START_DATE_UTC + (n - 1) * DAY_MS).toISOString().slice(0,10);
}
function weeklyCategoryForPuzzleNo(n, rng) {
  const day = (n - 1) % 7; // #1 = Wednesday? But schedule starts from fixed categories independent of real weekday? Use Monday sequence below.
  // User's final weekly schedule: Mon distance, Tue capital, Wed distance, Thu flag, Fri distance, Sat knowledge, Sun equator.
  // GeoRank #1 date is Wednesday 2026-06-17, so derive actual UTC weekday.
  const d = new Date(START_DATE_UTC + (n - 1) * DAY_MS).getUTCDay(); // Sun=0
  if (d === 1) return "distance";
  if (d === 2) return "capitalAZ";
  if (d === 3) return "distance";
  if (d === 4) return "flagsCapitalAZ";
  if (d === 5) return "distance";
  if (d === 6) return "knowledge";
  return "equator";
}

const COUNTRIES_CLEAN = COUNTRIES.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));

function makeDistancePuzzle(rng) {
  const wellKnown = COUNTRIES_CLEAN.filter(c => GOOD_REFERENCE_CAPITALS.has(c.capital) && !WEAK_REFERENCE_CAPITALS.has(c.capital));
  const hard = COUNTRIES_CLEAN.filter(c => HARD_REFERENCE_CAPITALS.has(c.capital) && !WEAK_REFERENCE_CAPITALS.has(c.capital));
  const pool = rng() < 0.5 ? wellKnown : hard;
  const reference = sample(pool.length ? pool : COUNTRIES_CLEAN, rng);

  let best = null;
  for (let attempt = 0; attempt < 800; attempt++) {
    const candidates = shuffle(COUNTRIES_CLEAN.filter(c => c.country !== reference.country), rng).slice(0, 10);
    const items = candidates.map(c => ({...c, value: haversineKm(reference, c)}));
    if (new Set(items.map(i => Math.round(i.value))).size < 10) continue;
    const sorted = [...items].sort((a,b) => a.value - b.value);
    const gaps = sorted.slice(1).map((x,i) => x.value - sorted[i].value);
    const closeCalls = gaps.filter(g => g < 650).length;
    const veryClose = gaps.filter(g => g < 350).length;
    const latSpread = Math.max(...items.map(i => i.lat)) - Math.min(...items.map(i => i.lat));
    const lngSpread = Math.max(...items.map(i => i.lng)) - Math.min(...items.map(i => i.lng));
    const tooObviousExtremes = gaps[0] > 1500 || gaps[gaps.length-1] > 2500;
    const score = closeCalls*12 + veryClose*8 + Math.min(latSpread, 110)/10 + Math.min(lngSpread, 220)/18 - (tooObviousExtremes ? 22 : 0);
    if (!best || score > best.quality) best = {items, sorted, quality: Math.round(score), closeCalls, veryClose, latSpread, lngSpread, reference};
  }
  return {
    type: "distance",
    icon: "🌍",
    title: "Distance Day",
    instruction: `Order these capital cities by distance from ${reference.capital} (closest → furthest).`,
    reference: `${reference.flag} Reference capital: ${reference.capital}`,
    promptItems: shuffle(best.items, rng),
    answerItems: best.sorted,
    valueLabel: x => fmtKm(x.value),
    diagnostics: best
  };
}

function makeEquatorPuzzle(rng) {
  let best = null;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const north = shuffle(COUNTRIES_CLEAN.filter(c => c.lat > 0), rng).slice(0, 5 + Math.floor(rng()*2));
    const south = shuffle(COUNTRIES_CLEAN.filter(c => c.lat < 0), rng).slice(0, 10 - north.length);
    const items = shuffle([...north, ...south], rng).map(c => ({...c, value: Math.abs(c.lat)}));
    if (items.length !== 10) continue;
    if (items.filter(i => i.lat > 0).length < 3 || items.filter(i => i.lat < 0).length < 3) continue;
    const sorted = [...items].sort((a,b) => a.value - b.value);
    const gaps = sorted.slice(1).map((x,i) => x.value - sorted[i].value);
    const crossClose = sorted.slice(1).filter((x,i) => Math.sign(x.lat) !== Math.sign(sorted[i].lat) && Math.abs(x.value - sorted[i].value) < 8).length;
    const closeCalls = gaps.filter(g => g < 6).length;
    const extremesPenalty = sorted[0].value < 1 ? 8 : 0;
    const score = closeCalls*10 + crossClose*20 - extremesPenalty;
    if (!best || score > best.quality) best = {items, sorted, quality: Math.round(score), closeCalls, crossClose, northCount: items.filter(i=>i.lat>0).length, southCount: items.filter(i=>i.lat<0).length};
  }
  return {
    type: "equator",
    icon: "🌎",
    title: "Equator Day",
    instruction: "Order these capital cities by distance from the Equator (closest → furthest).",
    reference: null,
    promptItems: shuffle(best.items, rng),
    answerItems: best.sorted,
    valueLabel: x => `${x.value.toFixed(2)}° ${x.lat >= 0 ? "N" : "S"}`,
    diagnostics: best
  };
}

function difficultySample(rng, pattern, allowVeryHard = true) {
  const buckets = {
    easy: COUNTRIES_CLEAN.filter(c => c.difficulty === "easy"),
    medium: COUNTRIES_CLEAN.filter(c => c.difficulty === "medium"),
    hard: COUNTRIES_CLEAN.filter(c => c.difficulty === "hard"),
    veryHard: COUNTRIES_CLEAN.filter(c => c.difficulty === "veryHard")
  };
  let picked = [];
  for (const [diff, count] of Object.entries(pattern)) {
    const pool = buckets[diff] || [];
    picked.push(...shuffle(pool, rng).slice(0, count));
  }
  while (picked.length < 10) picked.push(sample(COUNTRIES_CLEAN, rng));
  return uniqueBy(shuffle(picked, rng), c => c.country).slice(0, 10);
}

function makeCapitalAZPuzzle(rng, flags = false) {
  let best = null;
  const pattern = flags ? {easy:1, medium:3, hard:4, veryHard:2} : {easy:1, medium:4, hard:4, veryHard:1};
  for (let attempt = 0; attempt < 500; attempt++) {
    const items = difficultySample(rng, pattern).map(c => ({...c, value: alphabetValue(c.capital)}));
    if (items.length !== 10) continue;
    const sorted = [...items].sort((a,b) => a.value.localeCompare(b.value));
    const starts = new Set(items.map(i => alphabetValue(i.capital)[0]));
    const diffs = items.reduce((acc,i) => (acc[i.difficulty]=(acc[i.difficulty]||0)+1, acc), {});
    const gaps = sorted.slice(1).map((x,i) => alphabeticalGap(x.capital, sorted[i].capital));
    const closeCalls = gaps.filter(g => g <= 3).length;
    const sameStartBonus = 10 - starts.size;
    const score = closeCalls*8 + sameStartBonus*5 + (diffs.hard||0)*4 + (diffs.veryHard||0)*7;
    if (!best || score > best.quality) best = {items, sorted, quality: Math.round(score), closeCalls, starts: starts.size, difficultyMix: diffs};
  }
  return {
    type: flags ? "flagsCapitalAZ" : "capitalAZ",
    icon: flags ? "🚩" : "🏛️",
    title: flags ? "Flag Day" : "Capital Day",
    instruction: flags ? "Order these flags by the alphabetical order of their capital cities (A-Z)." : "Order these countries by the alphabetical order of their capital cities (A-Z).",
    reference: null,
    promptItems: shuffle(best.items, rng),
    answerItems: best.sorted,
    valueLabel: x => x.capital,
    diagnostics: best,
    flagsOnly: flags
  };
}

function makeKnowledgePuzzle(rng, forced) {
  let category = forced;
  if (category === "knowledge") {
    const r = rng();
    category = r < 0.40 ? "population" : r < 0.80 ? "area" : r < 0.90 ? "highestPoint" : "coastline";
  }
  const metricMap = {
    population: {title:"Population", instruction:"Order these countries by population (largest → smallest).", key:"population", fmt: fmtPop, icon:"📊"},
    area: {title:"Area", instruction:"Order these countries by area (largest → smallest).", key:"areaKm2", fmt: v => `${Math.round(v).toLocaleString()} km²`, icon:"📊"},
    coastline: {title:"Coastline", instruction:"Order these countries by coastline length (longest → shortest).", key:"coastlineKm", fmt: fmtKm, icon:"📊"},
    highestPoint: {title:"Highest Point", instruction:"Order these countries by highest point elevation (highest → lowest).", key:"highestPointM", fmt: v => `${Math.round(v).toLocaleString()} m`, icon:"📊"}
  };
  const m = metricMap[category];
  const valid = COUNTRIES_CLEAN.filter(c => Number.isFinite(c[m.key]));
  const sortedAll = [...valid].sort((a,b) => a[m.key] - b[m.key]);
  let best = null;
  for (let attempt = 0; attempt < 800; attempt++) {
    // Sample mostly from middle 80%, with occasional edge countries.
    const mid = sortedAll.slice(Math.floor(sortedAll.length*0.08), Math.ceil(sortedAll.length*0.92));
    let items = shuffle(mid, rng).slice(0, 10);
    if (rng() < 0.22) items[Math.floor(rng()*10)] = sample(valid, rng);
    items = uniqueBy(items, c => c.country);
    if (items.length !== 10) continue;
    const values = items.map(i => i[m.key]);
    if (new Set(values).size !== 10) continue;
    if ((category === "coastline") && values.filter(v => v === 0).length > 1) continue;
    const answer = items.map(c => ({...c, value: c[m.key]})).sort((a,b) => b.value - a.value);
    const gaps = answer.slice(1).map((x,i) => Math.abs(answer[i].value - x.value));
    const range = Math.max(...values) - Math.min(...values);
    const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const relativeClose = gaps.filter(g => g < range * 0.10).length;
    const obviousPenalty = (Math.max(...values) === sortedAll[sortedAll.length-1][m.key] || Math.min(...values) === sortedAll[0][m.key]) ? 12 : 0;
    const score = relativeClose*10 + Math.max(0, 25 - Math.log10(range+1)*3) - obviousPenalty;
    if (!best || score > best.quality) best = {items: answer, sorted: answer, quality: Math.round(score), closeCalls: relativeClose, range, avgGap, metric: category};
  }
  return {
    type: category,
    icon: m.icon,
    title: `${m.title} Day`,
    instruction: m.instruction,
    reference: null,
    promptItems: shuffle(best.items, rng),
    answerItems: best.sorted,
    valueLabel: x => category === "highestPoint" ? `${m.fmt(x.value)} · ${x.highestPointName || "Highest point"}` : m.fmt(x.value),
    diagnostics: best
  };
}

function generatePuzzle(category, puzzleNo, tweak=0) {
  const seed = hashString(`GeoRank:${puzzleNo}:${category}:${tweak}`);
  const rng = mulberry32(seed);
  let cat = category;
  if (cat === "weekly") cat = weeklyCategoryForPuzzleNo(puzzleNo, rng);
  if (cat === "distance") return makeDistancePuzzle(rng);
  if (cat === "equator") return makeEquatorPuzzle(rng);
  if (cat === "capitalAZ") return makeCapitalAZPuzzle(rng, false);
  if (cat === "flagsCapitalAZ") return makeCapitalAZPuzzle(rng, true);
  return makeKnowledgePuzzle(rng, cat);
}

function renderPuzzle(puzzle, puzzleNo) {
  document.getElementById("title").textContent = `GeoRank #${puzzleNo} · ${puzzle.icon} ${puzzle.title}`;
  document.getElementById("instruction").textContent = puzzle.instruction;
  document.getElementById("qualityScore").textContent = puzzle.diagnostics?.quality ?? "—";
  const refEl = document.getElementById("reference");
  if (puzzle.reference) { refEl.textContent = puzzle.reference; refEl.classList.remove("hidden"); }
  else refEl.classList.add("hidden");

  const prompt = document.getElementById("promptList");
  const answer = document.getElementById("answerList");
  prompt.innerHTML = "";
  answer.innerHTML = "";

  puzzle.promptItems.forEach((item, idx) => {
    const li = document.createElement("li");
    const label = puzzle.flagsOnly ? `<span class="flag">${item.flag}</span>` : `<span>${item.flag}</span><span>${puzzle.type === "distance" || puzzle.type === "equator" ? item.capital : item.displayCountry || item.country}</span>`;
    li.innerHTML = `<span class="main"><span class="rank">${idx+1}</span>${label}</span><span class="diff">${item.difficulty}</span>`;
    prompt.appendChild(li);
  });

  puzzle.answerItems.forEach((item, idx) => {
    const li = document.createElement("li");
    const name = puzzle.type === "distance" || puzzle.type === "equator" ? `${item.capital} <span class="meta">${item.flag} ${item.displayCountry || item.country}</span>` : `${item.flag} ${item.displayCountry || item.country}`;
    li.innerHTML = `<span class="main"><span class="rank">${idx+1}</span><span>${name}</span></span><span class="meta">${puzzle.valueLabel(item)}</span>`;
    answer.appendChild(li);
  });

  const d = puzzle.diagnostics || {};
  const diagPairs = [
    ["Date", dateForPuzzleNo(puzzleNo)],
    ["Generated category", puzzle.title],
    ["Close calls", d.closeCalls ?? d.crossClose ?? "—"],
    ["Difficulty mix", d.difficultyMix ? Object.entries(d.difficultyMix).map(([k,v])=>`${k}:${v}`).join(" · ") : "—"],
    ["North/South", d.northCount != null ? `${d.northCount}N / ${d.southCount}S` : "—"],
    ["Metric", d.metric || puzzle.type],
    ["Range", d.range ? Math.round(d.range).toLocaleString() : "—"],
    ["Reference", d.reference ? d.reference.capital : "—"]
  ];
  document.getElementById("diagnostics").innerHTML = diagPairs.map(([k,v]) => `<div class="diag"><strong>${v}</strong><span>${k}</span></div>`).join("");
}

let rerollCount = 0;
function currentPuzzleNo() { return Math.max(1, Number(document.getElementById("puzzleNo").value) || 1); }
function currentTweak() { return (Number(document.getElementById("seedTweak").value) || 0) + rerollCount; }
function doGenerate(resetReroll=false) {
  if (resetReroll) rerollCount = 0;
  const category = document.getElementById("category").value;
  const n = currentPuzzleNo();
  const puzzle = generatePuzzle(category, n, currentTweak());
  renderPuzzle(puzzle, n);
}

document.getElementById("countryCount").textContent = `${COUNTRIES_CLEAN.length} countries`;
document.getElementById("generate").addEventListener("click", () => doGenerate(true));
document.getElementById("reroll").addEventListener("click", () => { rerollCount++; doGenerate(false); });
document.getElementById("category").addEventListener("change", () => doGenerate(true));
document.getElementById("puzzleNo").addEventListener("input", () => doGenerate(true));
document.getElementById("seedTweak").addEventListener("input", () => doGenerate(true));

doGenerate(true);

// Prevent double tap zoom on iOS Safari/PWA.
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
