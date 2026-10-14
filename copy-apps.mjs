/**
 * copy-apps.mjs
 *
 * Postinstall script: copies (or hard-links) every code.html from the 10 Stitch
 * subfolder apps into frontend/public/apps/ so they can be served over HTTP and
 * embedded in iframes without CORS issues.
 *
 * Run automatically via:  npm run copy-apps
 * Also called by:         npm run dev  (via the "predev" hook)
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARENT_DIR = resolve(__dirname, "..");
const PUBLIC_APPS_DIR = join(__dirname, "public", "apps");

/**
 * Recursively walk a directory and collect all `code.html` file paths.
 */
function findHtmlFiles(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, results);
    } else if (entry.isFile() && (entry.name === "code.html" || entry.name.endsWith(".html") || entry.name.endsWith(".png") || entry.name.endsWith(".js") || entry.name.endsWith(".json") || entry.name.endsWith(".css"))) {
      results.push(fullPath);
    }
  }
  return results;
}

// Discover all stitch subfolders
const stitchFolders = readdirSync(PARENT_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("stitch_"))
  .map((d) => d.name);

let copied = 0;

for (const folder of stitchFolders) {
  const srcDir = join(PARENT_DIR, folder);
  const htmlFiles = findHtmlFiles(srcDir);

  for (const srcFile of htmlFiles) {
    // Preserve the relative path from the parent dir
    const relativePath = srcFile.slice(PARENT_DIR.length + 1);
    const destFile = join(PUBLIC_APPS_DIR, relativePath);
    const destDir = dirname(destFile);

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    copyFileSync(srcFile, destFile);
    copied++;
    console.log(`  ✓  ${relativePath}`);
  }
}

// Also copy the organogram (not inside a stitch_ folder)
const orgSrc = join(
  PARENT_DIR,
  "stitch_employee_database_management_system",
  "BCF Organogram Updated.html"
);
if (existsSync(orgSrc)) {
  const destOrg = join(
    PUBLIC_APPS_DIR,
    "stitch_employee_database_management_system",
    "BCF Organogram Updated.html"
  );
  mkdirSync(dirname(destOrg), { recursive: true });
  copyFileSync(orgSrc, destOrg);
  copied++;
  console.log(`  ✓  stitch_employee_database_management_system/BCF Organogram Updated.html`);
}

console.log(`\n✅  Copied ${copied} HTML file(s) → public/apps/`);
