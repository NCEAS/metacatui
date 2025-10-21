const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const hasCoverageFlag = args.includes("--coverage");
const envCoverageVal = (process.env.COVERAGE || "").trim();
const envCoverageEnabled = /^(1|true|yes|on)$/i.test(envCoverageVal);

const coverageEnabled = hasCoverageFlag || envCoverageEnabled;

const script = coverageEnabled
  ? path.join(__dirname, "coverage", "run-coverage.js")
  : path.join(__dirname, "server.js");

// Pass through all args except the --coverage flag
const passthroughArgs = args.filter((a) => a !== "--coverage");

const child = spawn(process.execPath, [script, ...passthroughArgs], {
  stdio: "inherit",
  env: { ...process.env, COVERAGE: coverageEnabled ? "1" : "" },
});

// Add above child.on('exit', ...) to detect fast exits
const start = Date.now();

child.on("exit", (code, signal) => {
  const ms = Date.now() - start;
  if (ms < 1000) {
    console.error(`[run-tests] Child exited quickly (${ms}ms). Code=${code} Signal=${signal || ""}`);
  }
  process.exit(code);
});
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});