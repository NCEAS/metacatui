/* Simple MetacatUI development server.

You'll need node.js and express.js to run this.
Install express.js with `npm install express`.

You'll also likely want to edit index.html and loader.js as needed.
See README.md for more details.
*/

const express = require("express");
const path = require("path");
const port = process.env.PORT || 3000;
const app = express();
const fs = require("fs");

// Subdirectory where index.html and the rest are
const src_dir = "src";

app.use(express.static(__dirname + "/" + src_dir));
app.get("*", function(request, response) {
  response.sendFile(path.resolve(__dirname, src_dir, "index.html"));
});
app.listen(port);

console.log("Now running at http://localhost:" + port);
