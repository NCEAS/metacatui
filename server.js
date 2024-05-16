/* Simple MetacatUI development server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm run dev`

You'll also likely want to edit index.html and loader.js as needed.
See README.md for more details.
*/

const express = require("express");
const path = require("path");
const port = process.env.PORT || 3000;
const app = express();

// Subdirectory where index.html and the rest are
const src_dir = "src";

app.use(express.static(__dirname + "/" + src_dir));


const nodeModulesDir = "node_modules";
app.use(express.static(__dirname + "/" + nodeModulesDir));

app.get("*", function(request, response) {
  response.sendFile(path.resolve(__dirname, src_dir, "index.html"));
});
app.listen(port);

console.log("Now running at http://localhost:" + port);
