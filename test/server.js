/* Simple MetacatUI test server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm run test`

See README.md for more details.
*/

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
if( testType && testType.length ){
    url += "?type=" + testType
}

// Redirect routes to the root to the test page
app.get('/', (req, res) => {
    res.redirect(url);
})

app.listen(port);
console.log("Tests are now running at http://localhost:" + port + url);
