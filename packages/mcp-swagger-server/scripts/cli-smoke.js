const fs = require("node:fs");
const path = require("node:path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const cliEntry = require(path.resolve(__dirname, "../dist/cli.js"));

const sandboxHome = path.resolve(__dirname, "../.tmp/test-home");
fs.mkdirSync(sandboxHome, { recursive: true });

process.env.HOME = sandboxHome;
process.env.USERPROFILE = sandboxHome;
process.env.HOMEDRIVE = path.parse(sandboxHome).root.replace(/\\$/, "");
process.env.HOMEPATH = sandboxHome.slice(process.env.HOMEDRIVE.length) || path.sep;
process.env.APPDATA = path.join(sandboxHome, "AppData", "Roaming");
process.env.LOCALAPPDATA = path.join(sandboxHome, "AppData", "Local");
fs.mkdirSync(process.env.APPDATA, { recursive: true });
fs.mkdirSync(process.env.LOCALAPPDATA, { recursive: true });

const interactiveCliEntry = require(path.resolve(__dirname, "../dist/cli-interactive.js"));
const cliArgs = require(path.resolve(__dirname, "../dist/cli/args.js"));

assert(typeof cliEntry.main === "function", "dist/cli.js should export main()");
assert(
  typeof interactiveCliEntry.main === "function",
  "dist/cli-interactive.js should export main()"
);
assert(typeof cliArgs.showHelp === "function", "dist/cli/args.js should export showHelp()");
assert(typeof cliArgs.parseCLIArgs === "function", "dist/cli/args.js should export parseCLIArgs()");

console.log("cli smoke passed");
