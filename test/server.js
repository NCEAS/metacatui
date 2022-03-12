/* Simple MetacatUI development server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm run dev`

You'll also likely want to edit index.html and loader.js as needed.
See README.md for more details.
*/

const express = require("express");
const path = require("path");
const port = process.env.PORT || 3001;
const app = express();

console.log(__dirname)
app.use(express.static("../"))
app.listen(port);

console.log("Tests are now running at http://localhost:" + port + "/test");
