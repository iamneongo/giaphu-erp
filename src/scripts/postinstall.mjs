import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const targetDir = path.resolve(__dirname, "../../node_modules/@dukelib/sheets-wasm");
  const targetFile = path.join(targetDir, "duke_sheets_wasm_bg.js");

  if (fs.existsSync(targetDir)) {
    if (!fs.existsSync(targetFile)) {
      try {
        fs.writeFileSync(targetFile, 'export * from "./duke_sheets_wasm.js";\n');
        console.log("Created duke_sheets_wasm_bg.js shim successfully.");
      } catch (error) {
        console.error("Failed to create duke_sheets_wasm_bg.js shim:", error);
      }
    } else {
      console.log("duke_sheets_wasm_bg.js shim already exists.");
    }
  } else {
    console.log("@dukelib/sheets-wasm is not installed, skipping shim generation.");
  }
}

main();
