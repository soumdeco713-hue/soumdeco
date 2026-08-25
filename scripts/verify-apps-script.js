// Verify the apps-script.gs is syntactically valid JavaScript.
// Reads the .gs file and parses it as a script (not module).
const fs = require("fs");
const vm = require("vm");

const files = [
  "/home/z/my-project/download/apps-script.gs",
  "/home/z/my-project/upload/apps-script.gs",
];

let allOk = true;
for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  try {
    // vm.Script doesn't run the code — it just parses + compiles it.
    // We don't execute it (would fail without Apps Script runtime).
    new vm.Script(code, { filename: file });
    console.log(`✅ ${file}: syntax OK (${code.split("\n").length} lines)`);
  } catch (err) {
    allOk = false;
    console.error(`❌ ${file}: SYNTAX ERROR`);
    console.error("   ", err.message);
    // Print the surrounding lines for context
    if (err.stack) {
      const m = err.stack.match(/<anonymous>:(\d+):(\d+)/);
      if (m) {
        const lineNum = parseInt(m[1], 10);
        const lines = code.split("\n");
        const start = Math.max(0, lineNum - 3);
        const end = Math.min(lines.length, lineNum + 2);
        for (let i = start; i < end; i++) {
          const marker = i === lineNum - 1 ? " >>> " : "     ";
          console.error(`${marker}${i + 1}: ${lines[i]}`);
        }
      }
    }
  }
}

process.exit(allOk ? 0 : 1);
