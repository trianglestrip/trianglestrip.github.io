import { readFileSync } from "node:fs";
const h = readFileSync("ref-html.txt", "utf8");
const start = h.indexOf("bottom-0 left-0 right-0 px-4");
console.log(h.slice(start, start + 5000));
