/* Simple MetacatUI development server.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- Run with `npm run dev`

You'll also likely want to edit index.html and loader.js as needed.
See README.md for more details.
*/
'use strict';

const main = require("./app");
const app = main.initializeApp()

app.listen(main.port)
console.log("Now running at http://localhost:" + main.port);