// Checks that the web GUI's Kruskal (docs/js/kruskal.js) gives exactly the
// same MST as the C++ program, by feeding random networks to both.
// Usage:  g++ -std=c++17 -o mst src/main.cpp && node tests/compare_with_cpp.js ./mst
const { execFileSync } = require("child_process");
const path = require("path");
const { kruskal } = require(path.join(__dirname, "..", "docs", "js", "kruskal.js"));

const binary = process.argv[2] || "./mst";
const RUNS = Number(process.argv[3] || 200);
let seed = 12345;
const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

function cppMst(cities, edges) {
  let input = "";
  for (const c of cities) input += `1\n${c}\n`;
  for (const e of edges) input += `3\n${e.city1}\n${e.city2}\n${e.cost}\n`;
  input += "5\n8\n";
  const out = execFileSync(binary, { input, cwd: require("os").tmpdir() }).toString();
  const lines = out.split("\n");
  const edgesOut = [];
  let total = null;
  for (const line of lines) {
    const m = line.match(/(\S+)---(\S+) having cost: (-?\d+)/);
    if (m) edgesOut.push(`${m[1]}-${m[2]}-${m[3]}`);
    const t = line.match(/Total MST cost: (-?\d+)/);
    if (t) total = Number(t[1]);
  }
  return { edges: edgesOut, total };
}

let failures = 0;
for (let r = 0; r < RUNS; r++) {
  const n = 1 + rand(9);
  const cities = Array.from({ length: n }, (_, i) => `City${i}`);
  const m = rand(n * 2 + 2);
  const edges = [];
  for (let i = 0; i < m; i++) {
    edges.push({ city1: cities[rand(n)], city2: cities[rand(n)], cost: rand(12) }); // small costs force ties
  }
  const js = kruskal(cities, edges);
  const jsEdges = js.mst.map((e) => `${e.city1}-${e.city2}-${e.cost}`);
  const cpp = cppMst(cities, edges);
  if (cpp.total !== js.totalCost || cpp.edges.join() !== jsEdges.join()) {
    failures++;
    console.error("Mismatch", { cities, edges, cpp, js: { edges: jsEdges, total: js.totalCost } });
    if (failures > 3) break;
  }
}
if (failures) { console.error(`${failures} mismatches`); process.exit(1); }
console.log(`OK: ${RUNS} random networks, C++ and web GUI chose identical MSTs.`);
