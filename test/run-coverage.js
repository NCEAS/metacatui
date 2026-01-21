/* Enhanced MetacatUI test server with coverage collection.
   This is the main coverage-enabled test runner.
*/

const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const express = require("express");
const path = require("path");
const fs = require("fs");
const libCoverage = require("istanbul-lib-coverage");
const v8toIstanbul = require("v8-to-istanbul");
const core = require("@actions/core");

// Configuration from environment and args
const args = process.argv.slice(2);
const port = process.env.PORT || 3001;

const KEEP_OPEN = args.includes("--keep-open") || /^(1|true|yes|on)$/i.test(process.env.KEEP_OPEN || "");
const HEADFUL = args.includes("--headful") || /^(1|true|yes|on)$/i.test(process.env.COVERAGE_HEADFUL || "");
const VERBOSE = args.includes("--verbose") || /^(1|true|yes|on)$/i.test(process.env.COVERAGE_DEBUG || "") || true;

// Coverage output paths
const COVERAGE_ARTIFACTS_DIR = path.join(process.cwd(), "coverage-artifacts");
const NYC_OUTPUT_DIR = path.join(process.cwd(), ".nyc_output");
const JS_COVERAGE_FILE = process.env.JS_COVERAGE_FILE || path.join(COVERAGE_ARTIFACTS_DIR, "js-coverage-raw.json");
const NYC_OUTPUT_FILE = path.join(NYC_OUTPUT_DIR, "coverage-final.json");

function log(...args) {
  if (VERBOSE) console.log("[coverage]", ...args);
}

function ensureRequiredDirectories() {
  const dirs = [COVERAGE_ARTIFACTS_DIR, NYC_OUTPUT_DIR, path.dirname(JS_COVERAGE_FILE)];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
}

// Call this at the very beginning
ensureRequiredDirectories();

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Set up Express server
const app = express();
const rootDir = path.resolve(__dirname, "../..");
app.use(express.static(rootDir));

// Determine test type and URL
let testType = args.filter(arg => !arg.startsWith("--"))[0];
let url = "/test";
if (testType && testType !== "keep-running") {
  url += "?type=" + testType;
}

app.get("/", (req, res) => {
  res.redirect(url);
});

// FIX: Create a function to convert ranges to functions format for v8-to-istanbul
function convertRangesToFunctions(ranges, sourceText) {
  if (!ranges || !Array.isArray(ranges)) return [];
  
  // Convert ranges to a basic functions format that v8-to-istanbul can handle
  const functions = [];
  
  // Create a single function covering the entire script
  if (ranges.length > 0) {
    const fullRange = {
      startOffset: 0,
      endOffset: sourceText.length,
      count: ranges.some(r => r.count > 0) ? 1 : 0  // If any range was executed, mark function as executed
    };
    
    functions.push({
      functionName: '',
      ranges: [fullRange],
      isBlockCoverage: false
    });
  }
  
  return functions;
}

async function convertAndWriteIstanbulCoverage(jsCoverageEntries) {
  ensureDirFor(NYC_OUTPUT_FILE);
  
  // CRITICAL FIX: Clean up .nyc_output directory first to prevent conflicts
  const nycDir = path.dirname(NYC_OUTPUT_FILE);
  if (fs.existsSync(nycDir)) {
    const files = fs.readdirSync(nycDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fullPath = path.join(nycDir, file);
        fs.unlinkSync(fullPath);
        console.log(`🗑️  Removed old coverage file: ${file}`);
      }
    }
    // Also clean up processinfo directory if it exists
    const processinfoDir = path.join(nycDir, 'processinfo');
    if (fs.existsSync(processinfoDir)) {
      const processingFiles = fs.readdirSync(processinfoDir);
      for (const file of processingFiles) {
        fs.unlinkSync(path.join(processinfoDir, file));
      }
      fs.rmdirSync(processinfoDir);
      console.log(`🗑️  Cleaned up processinfo directory`);
    }
  }
  
  console.log("\n=== Fixed Coverage Conversion ===");
  console.log(`Total V8 coverage entries: ${jsCoverageEntries?.length || 0}`);
  
  const localFiles = jsCoverageEntries?.filter(entry => {
    try {
      const parsedUrl = new URL(entry.url);
      return ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname) &&
             parsedUrl.pathname.startsWith("/src/js/") &&
             !parsedUrl.pathname.includes("/test/") &&
             !parsedUrl.pathname.includes("/node_modules/");
    } catch {
      return false;
    }
  }) || [];
  
  console.log(`\nLocal source files found: ${localFiles.length}`);
  
  const coverageMap = libCoverage.createCoverageMap({});
  let processedCount = 0;
  let skippedCount = 0;
  const skippedReasons = {};

  for (const entry of localFiles) {
    try {
      if (!entry || !entry.url || !entry.text) {
        skippedCount++;
        skippedReasons['no-url-or-text'] = (skippedReasons['no-url-or-text'] || 0) + 1;
        continue;
      }

      const parsedUrl = new URL(entry.url);
      const urlPath = parsedUrl.pathname;
      const cleanPath = urlPath.split('?')[0];
      const filePath = path.join(rootDir, cleanPath);
      
      if (!fs.existsSync(filePath)) {
        skippedCount++;
        skippedReasons['file-not-found'] = (skippedReasons['file-not-found'] || 0) + 1;
        continue;
      }

      // FIX: Handle both functions and ranges data
      let v8Functions = entry.functions;
      if (!v8Functions || !Array.isArray(v8Functions)) {
        // Convert ranges to functions format
        if (entry.ranges && Array.isArray(entry.ranges)) {
          v8Functions = convertRangesToFunctions(entry.ranges, entry.text);
          if (VERBOSE) {
            log(`Converted ranges to functions for ${entry.url}: ${v8Functions.length} functions`);
          }
        }
      }
      
      if (!v8Functions || !Array.isArray(v8Functions)) {
        skippedCount++;
        skippedReasons['no-coverage-data'] = (skippedReasons['no-coverage-data'] || 0) + 1;
        if (VERBOSE) {
          log(`No coverage data for ${entry.url}. Available keys:`, Object.keys(entry));
        }
        continue;
      }

      const sourceText = entry.text || fs.readFileSync(filePath, 'utf8');
      
      // Convert V8 coverage to Istanbul
      const converter = v8toIstanbul(filePath, 0, { source: sourceText });
      await converter.load();
      
      // Apply the V8 coverage
      converter.applyCoverage(v8Functions);

      const istanbulData = converter.toIstanbul();
      
      // Verify we got meaningful data
      const fileKeys = Object.keys(istanbulData);
      if (fileKeys.length > 0) {
        const fileData = istanbulData[fileKeys[0]];
        const executionCounts = Object.keys(fileData.s || {}).length;
        if (VERBOSE) {
          log(`✅ Converted ${entry.url} -> ${fileKeys[0]} (${executionCounts} statements)`);
        }
      }
      
      coverageMap.merge(istanbulData);
      processedCount++;
      
    } catch (err) {
      skippedCount++;
      skippedReasons['conversion-error'] = (skippedReasons['conversion-error'] || 0) + 1;
      log(`Failed to convert ${entry?.url || 'unknown'}: ${err.message}`);
      if (VERBOSE) {
        console.error(err.stack);
      }
    }
  }

  const istanbulData = coverageMap.toJSON();
  
  // Write ONLY the coverage-final.json file in the proper Istanbul format
  fs.writeFileSync(NYC_OUTPUT_FILE, JSON.stringify(istanbulData, null, 2), "utf8");
  
  const fileCount = Object.keys(istanbulData).length;
  console.log(`\n🎯 Coverage conversion complete:`);
  console.log(`   - ${processedCount} files processed`);
  console.log(`   - ${skippedCount} files skipped`);
  console.log(`   - ${fileCount} files in final Istanbul coverage`);
  console.log(`   - Istanbul coverage written to: ${NYC_OUTPUT_FILE}`);
  
  if (VERBOSE && skippedCount > 0) {
    console.log('Skip reasons:', skippedReasons);
  }
  
  // Provide more actionable feedback
  if (fileCount === 0) {
    console.log("\n❌ NO COVERAGE DATA GENERATED!");
    console.log("Possible causes:");
    console.log("- RequireJS modules not properly instrumented");
    console.log("- V8 coverage not capturing function execution");
    console.log("- File path mapping issues");
  } else {
    console.log(`\n✅ Coverage data generated for ${fileCount} files!`);
  }
  
  return istanbulData;
}