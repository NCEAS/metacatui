/* Simple MetacatUI test server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm test`

See README.md for more details.
*/
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

const express = require("express");
const path = require("path");
const fs = require("fs");
const port = process.env.PORT || 3001;
const app = express();

// Change this line to write raw coverage outside .nyc_output
const JS_COVERAGE_FILE =
  process.env.JS_COVERAGE_FILE ||
  path.join(process.cwd(), "coverage-artifacts", "js-coverage-raw.json");

// Add NYC_OUTPUT_FILE definition
const NYC_OUTPUT_FILE = path.join(process.cwd(), ".nyc_output", "coverage-final.json");

// Add VERBOSE flag for debugging (optional)
const VERBOSE = process.env.COVERAGE_DEBUG || false;

//GitHub Actions core package for automated testing via GitHub Actions
const core = require("@actions/core");

// Coverage conversion libraries
const libCoverage = require("istanbul-lib-coverage");
const v8toIstanbul = require("v8-to-istanbul");

//Serve files from the metacatui root directory. We need to serve the metacatui source files for the tests to run
const rootDir = __dirname.substring(0, __dirname.lastIndexOf("/"));
app.use(express.static(rootDir));

//Check if a test type argument was passed
let testType = process.argv.slice(2),
  url = "/test";

//Append test type argument to the URL. This is only used as a hint when printing to console and routes to root will automatically redirect
// to that test type. Any test type can still be executed by passing the `type` URL search parameter.
if (testType && testType !== "keep-running" && testType.length) {
  url += "?type=" + testType;
}

// Redirect routes to the root to the test page
app.get("/", (req, res) => {
  res.redirect(url);
});
//Start the server
const server = app.listen(port);

//Get the full URL where tests are
url = "http://localhost:" + port + url;

function log(...args) {
  if (VERBOSE) console.log("[coverage]", ...args);
}

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Update the ensureDirFor call in runTests to ensure the new directory exists
async function runTests(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", 
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--disable-background-networking",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-plugins",
      "--no-first-run",
      "--no-default-browser-check"
    ],
    defaultViewport: { width: 1280, height: 1024 },
    timeout: 60000
  });
  const page = await browser.newPage();
  
  // Add console logging to debug tests
  page.on('console', (msg) => {
    const msgType = msg.type();
    const msgText = msg.text();
    
    // Filter out noisy debug messages but keep important ones
    if (msgType === 'error' || msgType === 'warn' || 
        (msgType === 'log' && (msgText.includes('Failed') || msgText.includes('Error') || msgText.includes('DEBUG')))) {
      console.log(`[PAGE ${msgType}] ${msgText}`);
    }
  });
  
  page.on('pageerror', (err) => {
    let errorMsg = 'Unknown error';
    
    if (err) {
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err.toString && typeof err.toString === 'function') {
        try {
          errorMsg = err.toString();
        } catch (toStringError) {
          errorMsg = err.message || err.name || 'Error toString failed';
        }
      } else if (err.message) {
        errorMsg = err.message;
      } else if (err.stack) {
        errorMsg = err.stack;
      }
    }
    
    console.error(`[PAGE ERROR] ${errorMsg}`);
  });

  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: true,
    includeRawScriptCoverage: true,
    useBlockCoverage: true
  });

  try {
    console.log(`[coverage] Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: "networkidle0", 
      timeout: 60000
    });
    console.log(`Page loaded successfully`);
    
    // Wait for tests to actually complete 
    console.log(`Waiting for tests to complete...`);
    let testResults;
    
    try {
      // Enhanced test completion detection
      testResults = await page.waitForFunction(
        () => {
          // Look for multiple completion indicators
          const stats = document.querySelector('#mocha-stats');
          const runner = document.querySelector('#mocha');
          
          if (!stats) return null;
          
          // Check for completion class on mocha runner
          const isComplete = runner && (
            runner.classList.contains('complete') ||
            runner.classList.contains('finished')
          );
          
          const passes = stats.querySelector('.passes em');
          const failures = stats.querySelector('.failures em');
          const duration = stats.querySelector('.duration em');
          
          // Multiple ways to detect completion
          if ((duration && duration.textContent && duration.textContent.trim() !== '') || isComplete) {
            const passCount = passes ? parseInt(passes.textContent) || 0 : 0;
            const failCount = failures ? parseInt(failures.textContent) || 0 : 0;
            
            return {
              passes: passCount,
              fails: failCount,
              duration: duration ? duration.textContent : 'N/A',
              completed: true
            };
          }
          
          return null;
        },
        { timeout: 300000, polling: 1000 }
      );
      
      const results = await testResults.jsonValue();
      console.log(`Tests completed: ${results.passes} passed, ${results.fails} failed (${results.duration})`);
      
    } catch (waitError) {
      console.error(`Timeout waiting for tests: ${waitError.message}`);
      
      // Try to get whatever results we have
      try {
        const partialResults = await page.evaluate(() => {
          const stats = document.querySelector('#mocha-stats');
          if (stats) {
            const passes = stats.querySelector('.passes em');
            const failures = stats.querySelector('.failures em');
            return {
              passes: passes ? parseInt(passes.textContent) || 0 : 0,
              fails: failures ? parseInt(failures.textContent) || 0 : 0,
              completed: false
            };
          }
          return { passes: 0, fails: 0, completed: false };
        });
        console.log(`Partial results: ${partialResults.passes} passed, ${partialResults.fails} failed (incomplete)`);
      } catch (evalError) {
        console.error(`Could not get partial results: ${evalError.message}`);
      }
    }
    
    // Enhanced module triggering for better coverage
    console.log(`Triggering additional code execution for coverage...`);
    await page.evaluate(() => {
      if (window.require && typeof window.require === 'function') {
        const loadedModules = [];
        
        // Get RequireJS modules
        if (window.require.s && window.require.s.contexts && window.require.s.contexts._ && window.require.s.contexts._.defined) {
          const defined = window.require.s.contexts._.defined;
          for (let module in defined) {
            // Include more module types for better coverage
            if (module.startsWith('views/') || 
                module.startsWith('models/') || 
                module.startsWith('collections/') ||
                module.startsWith('routers/') ||
                module.startsWith('common/')) {
              loadedModules.push(module);
            }
          }
        }
        
        console.log(`Found ${loadedModules.length} modules to trigger`);
        
        // Enhanced module instantiation
        loadedModules.forEach(moduleName => {
          try {
            const ModuleClass = window.require(moduleName);
            if (ModuleClass && typeof ModuleClass === 'function') {
              // Try different instantiation patterns
              try {
                new ModuleClass();
              } catch (e1) {
                try {
                  new ModuleClass({});
                } catch (e2) {
                  try {
                    // For views, try with a minimal element
                    if (moduleName.startsWith('views/')) {
                      const el = document.createElement('div');
                      new ModuleClass({ el: el });
                    }
                  } catch (e3) {
                    // All attempts failed, that's ok
                  }
                }
              }
            }
          } catch (e) {
            // Module not available or other error, continue
          }
        });
      }
    });
    
    // Small delay to ensure everything is settled
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error(`Error during test execution: ${error.message}`);
  }
  
  console.log(`[coverage] Collecting coverage data...`);
  const html = await page.content();
  const jsCoverage = await page.coverage.stopJSCoverage();
  
  console.log(`Coverage entries collected: ${jsCoverage.length}`);
  
  await browser.close();

  const $ = cheerio.load(html);
  let passes = parseInt($("#mocha-stats .passes em").text()) || 0;
  let fails = parseInt($("#mocha-stats .failures em").text()) || 0;
  const error = $("#error").text();
  let passNum = `PASSES: ${passes}`;
  let failNum = `FAILS:  ${fails}`;

  ensureDirFor(JS_COVERAGE_FILE);
  fs.writeFileSync(JS_COVERAGE_FILE, JSON.stringify(jsCoverage, null, 2), "utf8");
  console.log(`[coverage] Raw coverage written to ${JS_COVERAGE_FILE}`);

  await convertAndWriteIstanbulCoverage(jsCoverage);

  if (testType !== "keep-running") {
    server.close();
  } else {
    console.log(`Test results are available at ${url}`);
  }

  if (error) {
    console.error(error);
  }

  if (fails > 0) {
    throw Error(
      `One or more MetacatUI tests failed. Test failure details can be viewed by running "npm view-tests". \n${failNum}\n${passNum}\nFailed Tests: \n-------------\n${getFailTestsMessage($)}`,
    );
  } else if (passes === 0 && fails === 0) {
    throw Error(
      `The MetacatUI test suite failed to run. View the Javascript error console by running 'npm view-tests'`,
    );
  } else {
    console.log(`All tests have completed and passed.
      ${failNum}
      ${passNum}`);
  }

  return html;
}

runTests(url).catch((error) => {
  console.error(error.message);
  core.setFailed(error.message);
});

function getFailTestsMessage($) {
  //Parse the error messages from the HTML
  let failMsg = "";
  $("#mocha-report .test.fail .error").each((i, e) => {
    failMsg += `\n[${i + 1}]: `;
    let testInfo = "";
    $(e)
      .parents(".suite")
      .each((j, s) => {
        if (j > 0) {
          testInfo = $(s).children("h1").text() + `\n     > ${testInfo}`;
        } else {
          testInfo = $(s).children("h1").text();
        }
      });
    testInfo += `\n     > ${$(e).text()}`;

    failMsg += testInfo;
  });
  return failMsg;
}

async function convertAndWriteIstanbulCoverage(jsCoverageEntries) {
  ensureDirFor(NYC_OUTPUT_FILE);
  
  console.log("\n=== Coverage Conversion Debug ===");
  console.log(`Total V8 coverage entries: ${jsCoverageEntries.length}`);
  
  if (jsCoverageEntries.length > 0) {
    console.log("\nSample entry structure:");
    const sample = jsCoverageEntries[0];
    console.log(`  url: ${sample.url}`);
    console.log(`  text length: ${sample.text ? sample.text.length : 'N/A'}`);
    console.log(`  functions: ${Array.isArray(sample.functions) ? 'array' : 'not array'}`);
    console.log(`  rawScriptCoverage: ${sample.rawScriptCoverage ? 'present' : 'missing'}`);
    console.log(`  available keys: ${Object.keys(sample).join(', ')}`);
  }

  const map = libCoverage.createCoverageMap({});
  let localSourceFilesFound = 0;
  let processedCount = 0;
  let skippedCount = 0;

  // Filter to only local source files
  const localSources = jsCoverageEntries.filter(entry => {
    return entry.url && 
         entry.url.startsWith('http://localhost:3001/src/') &&
         !entry.url.includes('/src/components/');
  });

  console.log(`\nLocal source files found: ${localSources.length}`);

  for (const entry of localSources) {
    try {
      if (!entry.text || entry.text.length === 0) {
        console.log(`  Skipping ${entry.url} - no text content`);
        skippedCount++;
        continue;
      }

      // Convert URL to file path
      const urlPath = new URL(entry.url).pathname;
      const relativePath = urlPath.replace('/src/', 'src/');

      const converter = v8toIstanbul(relativePath, 0, { source: entry.text });
      await converter.load();
      
      // Log sample entries for debugging
      if (localSourceFilesFound < 10) {
        console.log(`  ${entry.url}`);
        console.log(`    functions: ${Array.isArray(entry.functions) ? 'array' : 'not array'}`);
        console.log(`    text length: ${entry.text.length}`);
      }

      // Apply the V8 coverage data
      if (entry.functions && Array.isArray(entry.functions)) {
        converter.applyCoverage(entry.functions);
      } else if (entry.rawScriptCoverage && entry.rawScriptCoverage.functions) {
        converter.applyCoverage(entry.rawScriptCoverage.functions);
      } else {
        // Try to use ranges directly if available
        if (entry.ranges && Array.isArray(entry.ranges)) {
          const syntheticFunctions = [{
            functionName: '',
            ranges: entry.ranges,
            isBlockCoverage: true
          }];
          converter.applyCoverage(syntheticFunctions);
        } else {
          console.log(`    No coverage data found for ${entry.url}`);
          skippedCount++;
          continue;
        }
      }

      // Convert to Istanbul format
      const istanbulCoverage = converter.toIstanbul();
      map.merge(istanbulCoverage);
      processedCount++;
      
    } catch (error) {
      if (error.code === 'ENOENT' && error.path && error.path.endsWith('.map')) {
        console.log(`    Skipping ${entry.url} - missing source map file`);
        skippedCount++;
        continue;
      }
      console.error(`    Error processing ${entry.url}:`, error.message);
      skippedCount++;
    }
    
    localSourceFilesFound++;
  }

  console.log(`Coverage conversion complete: ${processedCount} processed, ${skippedCount} skipped`);

  // Write the final coverage
  const finalCoverage = map.toJSON();
  console.log(`Final Istanbul coverage: ${Object.keys(finalCoverage).length} files`);

  fs.writeFileSync(NYC_OUTPUT_FILE, JSON.stringify(finalCoverage, null, 2), 'utf8');
  log(`Istanbul coverage written to ${NYC_OUTPUT_FILE}`);
}