/* Simple MetacatUI test server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm run test`

See README.md for more details.
*/
const puppeteer = require('puppeteer');
const cheerio = require("cheerio");

const express = require("express");
const path = require("path");
const port = process.env.PORT || 3001;
const app = express();

//Serve files from the metacatui root directory. We need to serve the metacatui source files for the tests to run
const rootDir = __dirname.substring(0, __dirname.lastIndexOf("/"))
app.use(express.static(rootDir))

//Check if a test type argument was passed
var testType = process.argv.slice(2),
    url = "/test";

//Append test type argument to the URL. This is only used as a hint when printing to console and routes to root will automatically redirect 
// to that test type. Any test type can still be executed by passing the `type` URL search parameter.
if( testType && testType!="keep-running" && testType.length ){
    url += "?type=" + testType
}

// Redirect routes to the root to the test page
app.get('/', (req, res) => {
    res.redirect(url);
})
//Start the server
const server = app.listen(port);

//Get the full URL where tests are
url="http://localhost:"+port+url;

async function ssr(url) {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto(url, {waitUntil: 'networkidle0'});
  const html = await page.content(); // serialized HTML of page DOM.
  await browser.close();
  //console.log(html)
//  const result_html = ssr("http://localhost:"+port+url);
const $ = cheerio.load(html);

//Get and print the results
let passes=parseInt($("#mocha-stats .passes em").text()) || 0;
let fails=parseInt($("#mocha-stats .failures em").text()) || 0;

console.log(`PASSES: ${passes}`);

if(fails>0){
    console.error(`FAILS: ${fails}`);
    console.error(`Test failure details can be viewed by running "npm view-tests" and visiting ${url}`)
}
else{
    console.error(`FAILS: ${fails}`);
}

  if(testType!="keep-running"){
    server.close();
  }
  else{
      console.log(`Test results are available at ${url}`);
  }

  return html;
}

ssr(url)



