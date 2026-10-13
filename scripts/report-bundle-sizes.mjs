import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

function sizes(buffer) {
  return {
    raw: buffer.length,
    gzip: gzipSync(buffer).length,
    brotli: brotliCompressSync(buffer).length,
  };
}

async function measureFile(root, name) {
  const buffer = await readFile(path.join(root, name));
  return { name: name.replaceAll("\\", "/"), ...sizes(buffer) };
}

async function measureBuild(root) {
  const htmlBuffer = await readFile(path.join(root, "index.html"));
  const html = htmlBuffer.toString("utf8");
  const initialRefs = [...html.matchAll(/(?:src|href)="\/([^"?]+\.(?:js|css))"/g)].map((match) => match[1]);
  const initial = [
    { name: "index.html", ...sizes(htmlBuffer) },
    ...(await Promise.all(initialRefs.map((name) => measureFile(root, name)))),
  ];
  const assetNames = (await readdir(path.join(root, "assets"))).filter((name) => /\.(?:js|css)$/.test(name));
  const assets = await Promise.all(assetNames.map((name) => measureFile(root, path.join("assets", name))));
  const initialTotals = initial.reduce(
    (total, item) => ({ raw: total.raw + item.raw, gzip: total.gzip + item.gzip, brotli: total.brotli + item.brotli }),
    { raw: 0, gzip: 0, brotli: 0 },
  );

  return {
    directory: root.replaceAll("\\", "/"),
    initial,
    initialTotals,
    largestAssets: assets.toSorted((left, right) => right.raw - left.raw).slice(0, 12),
  };
}

const directories = process.argv.slice(2);
if (!directories.length) directories.push("dist");
const reports = await Promise.all(directories.map((directory) => measureBuild(path.resolve(directory))));
console.log(JSON.stringify(reports, null, 2));
