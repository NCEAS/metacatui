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
const port = process.env.PORT || 3001;
const app = express();
const testTimeoutMs = 10 * 60 * 1000;

//GitHub Actions core package for automated testing via GitHub Actions
const core = require("@actions/core");

//Serve files from the metacatui root directory. We need to serve the metacatui source files for the tests to run
const rootDir = __dirname.substring(0, __dirname.lastIndexOf("/"));
app.use(express.static(rootDir));

const args = process.argv.slice(2);
const keepRunning = args[0] === "keep-running";
let url = "/test";
let specPath;

if (keepRunning) {
  args.shift();
}

const specArgIndex = args.indexOf("--spec");
if (specArgIndex >= 0) {
  specPath = args[specArgIndex + 1];

  if (!specPath || specPath.startsWith("--")) {
    failAndExit("Missing spec path after --spec.");
  }

  if (specPath.startsWith("test/")) {
    specPath = `./${specPath.substring(5)}`;
  } else if (!specPath.startsWith("./")) {
    specPath = `./${specPath}`;
  }

  args.splice(specArgIndex, 2);
}

const testType = args.shift();

if (args.length) {
  const unsupportedArgs = args.join(" ");
  failAndExit(
    `Unsupported test arguments: ${unsupportedArgs}. Use "npm run test:spec -- ./js/specs/unit/path/to/File.spec.js" or "npm run test:integration:spec -- ./js/specs/integration/path/to/File.spec.js" to run one spec.`,
  );
}

//Append test type argument to the URL. This is only used as a hint when printing to console and routes to root will automatically redirect
// to that test type. Any test type can still be executed by passing the `type` URL search parameter.
if (testType || specPath) {
  const params = new URLSearchParams();
  params.set("type", testType || "unit");

  if (specPath) {
    params.set("spec", specPath);
  }

  url += `?${params.toString()}`;
}

// Redirect routes to the root to the test page
app.get("/", (req, res) => {
  res.redirect(url);
});
//Start the server
const server = app.listen(port);

//Get the full URL where tests are
url = "http://localhost:" + port + url;

async function runTests(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    // Set by the test page after Mocha finishes or test loading fails.
    await page.waitForSelector("body[data-tests-finished]", {
      timeout: testTimeoutMs,
    });
  } catch {
    await browser.close();
    if (!keepRunning) server.close();
    throw Error(
      `The MetacatUI test run did not finish within ${testTimeoutMs / 60000} minutes. View the test page by running 'npm run view-tests'.`,
    );
  }
  const html = await page.content(); // serialized HTML of page DOM.
  await browser.close();

  const $ = cheerio.load(html);

  //Get and print the results
  let passes = parseInt($("#mocha-stats .passes em").text()) || 0;
  let fails = parseInt($("#mocha-stats .failures em").text()) || 0;
  const error = $("#error").text();
  let passNum = `PASSES: ${passes}`;
  let failNum = `FAILS:  ${fails}`;

  if (!keepRunning) {
    server.close();
  } else {
    console.log(`Test results are available at ${url}`);
  }

  if (error) {
    console.error(error);
  }

  if (error && passes === 0 && fails === 0) {
    throw Error(error);
  } else if (fails > 0) {
    const failureMessage = `One or more MetacatUI tests failed. Test failure details can be viewed by running "npm view-tests". \n${failNum}\n${passNum}\nFailed Tests: \n-------------\n${getFailTestsMessage($)}`;
    throw Error(failureMessage);
  } else if (passes === 0 && fails === 0) {
    throw Error(
      "The MetacatUI test suite failed to run. View the Javascript error console by running 'npm view-tests'",
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

function failAndExit(message) {
  console.error(message);
  core.setFailed(message);
  process.exit(1);
}

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
