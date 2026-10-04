/*
 * kruskal.js
 * A line-by-line port of the algorithm in src/main.cpp so the web GUI
 * produces exactly the same Minimum Spanning Tree as the C++ program:
 *   - merge sort on edge cost (same comparison: edges[i].cost < edges[j].cost)
 *   - union-find with recursive find, no path compression
 *   - union sets parent[root2] = root1
 * The only addition is that every step is recorded so the GUI can replay it.
 */
(function (global) {
  "use strict";

  // ---- Merge sort (mirrors ElectricityNetwork::merge / mergeSort) ----
  function merge(edges, left, mid, right) {
    const temp = [];
    let i = left;
    let j = mid + 1;
    while (i <= mid && j <= right) {
      if (edges[i].cost < edges[j].cost) {
        temp.push(edges[i]);
        i++;
      } else {
        temp.push(edges[j]);
        j++;
      }
    }
    while (i <= mid) temp.push(edges[i++]);
    while (j <= right) temp.push(edges[j++]);
    for (let k = 0; k < temp.length; k++) edges[left + k] = temp[k];
  }

  function mergeSort(edges, left, right) {
    if (left >= right) return;
    const mid = Math.floor((left + right) / 2);
    mergeSort(edges, left, mid);
    mergeSort(edges, mid + 1, right);
    merge(edges, left, mid, right);
  }

  function sortEdges(edges) {
    const copy = edges.slice();
    if (copy.length) mergeSort(copy, 0, copy.length - 1);
    return copy;
  }

  // ---- Union-Find (mirrors parentFind / unionCities) ----
  function parentFind(parent, city) {
    if (parent[city] === city) return city;
    return parentFind(parent, parent[city]);
  }

  // Path walked by find, used by the GUI to show how the root was reached
  function findPath(parent, city) {
    const path = [city];
    while (parent[city] !== city) {
      city = parent[city];
      path.push(city);
    }
    return path;
  }

  /**
   * Run Kruskal's algorithm.
   * @param {string[]} cities
   * @param {{city1:string, city2:string, cost:number}[]} edges
   * @returns {{sorted, steps, mst, totalCost, connected, components}}
   */
  function kruskal(cities, edges) {
    const sorted = sortEdges(edges);
    const parent = cities.map((_, i) => i); // set(): every city is its own parent
    const index = new Map(cities.map((c, i) => [c, i]));
    const steps = [];
    const mst = [];
    let totalCost = 0;

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const a = index.has(e.city1) ? index.get(e.city1) : -1;
      const b = index.has(e.city2) ? index.get(e.city2) : -1;
      if (a === -1 || b === -1) {
        steps.push({ order: i, edge: e, status: "missing", parent: parent.slice() });
        continue;
      }
      const pathA = findPath(parent, a);
      const pathB = findPath(parent, b);
      const bossA = parentFind(parent, a);
      const bossB = parentFind(parent, b);
      let status;
      if (bossA !== bossB) {
        mst.push(e);
        totalCost += e.cost;
        // unionCities(bossA, bossB) -> parent[find(bossB)] = find(bossA)
        parent[bossB] = bossA;
        status = "accepted";
      } else {
        status = "cycle";
      }
      steps.push({
        order: i, edge: e, status,
        a, b, bossA, bossB, pathA, pathB,
        parent: parent.slice(),
        totalCost,
      });
    }

    const roots = new Set(cities.map((_, i) => parentFind(parent, i)));
    return {
      sorted, steps, mst, totalCost,
      components: roots.size,
      connected: cities.length > 0 && roots.size === 1,
    };
  }

  // ---- network.txt format (same as saveData / loadData) ----
  function toNetworkTxt(cities, edges) {
    const lines = [String(cities.length), ...cities, String(edges.length)];
    for (const e of edges) lines.push(`${e.city1} ${e.city2} ${e.cost}`);
    return lines.join("\n") + "\n";
  }

  function fromNetworkTxt(text) {
    // loadData() reads whitespace-separated tokens, so do the same
    const t = text.split(/\s+/).filter(Boolean);
    let p = 0;
    const next = () => {
      if (p >= t.length) throw new Error("The file ended early. Check the city and connection counts.");
      return t[p++];
    };
    const cityCount = parseInt(next(), 10);
    if (!Number.isInteger(cityCount) || cityCount < 0) throw new Error("The first line must be the number of cities.");
    const cities = [];
    for (let i = 0; i < cityCount; i++) cities.push(next());
    const edgeCount = parseInt(next(), 10);
    if (!Number.isInteger(edgeCount) || edgeCount < 0) throw new Error("The line after the cities must be the number of connections.");
    const edges = [];
    for (let i = 0; i < edgeCount; i++) {
      const city1 = next(), city2 = next(), cost = parseInt(next(), 10);
      if (!Number.isInteger(cost)) throw new Error(`Connection ${i + 1} has a cost that is not a whole number.`);
      edges.push({ city1, city2, cost });
    }
    return { cities, edges };
  }

  const api = { kruskal, sortEdges, parentFind, toNetworkTxt, fromNetworkTxt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Kruskal = api;
})(typeof window !== "undefined" ? window : globalThis);
