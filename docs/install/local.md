# Installing MetacatUI locally for development with a Metacat repository

## Step 1. Clone MetacatUI

- Clone the MetacatUI git repository:

  ```bash
  git clone https://github.com/NCEAS/metacatui.git
  ```

## Step 2. Set up a local web server

While developing on MetacatUI, it's necessary to run a web server of some sort in order for the application to work completely.
It will not work properly by simply opening up the HTML webpage(s) in your browser.
This is due to browser security issues that prevent certain Javascript functions from executing
on local files, but also because MetacatUI needs certain web server configurations for navigation
to work properly (more on that later).

Following are instructions for two local web server options - Node & Express JS (recommended) or Apache.

### Server Option 1. NodeJS & ExpressJS (recommended)

*Requirements:* [NodeJS](https://nodejs.org/en/download/) and ExpressJS.

MetacatUI also comes with a simple script that runs a [node.js](https://nodejs.org) application called [Express.js](https://expressjs.com), which can serve MetacatUI.

Before starting the server, ensure the dependencies are installed:

```sh
npm install
```

Then, to start the Express server:

```bash
npm run dev # or equivalent to node server.js
```

### Server Option 2. Apache

See the [Apache configuration instructions](apache.html).
The Apache instructions are *not* updated regularly, since we recommend you use the NodeJS Express server instead.

## Step 3. Configure MetacatUI

### For MetacatUI v2.12.0 and later
MetacatUI will work out-of-box without a configuration file, but if you have customized
any part of the Metacat installation process, you may need to configure MetacatUI.

Create a configuration Javascript file, `config.js`, and define a `MetacatUI.AppConfig` JS object
that contains all of your custom `AppConfig` values. See the [`AppConfig` documentation](../docs/AppConfig.html) to see
all available config options.

A quick-start `config.js` could look like:

  ```javascript
    MetacatUI.AppConfig = {
      //The path to the root location of MetacatUI, i.e. where index.html is
      root: "/",
      //The path to the root location of Metacat, i.e. name of the Metacat Tomcat webapp
      metacatContext: "/metacat",
      //Your Google Maps API key, for map features
      mapKey: "YOUR-GOOGLE-MAPS-KEY"
    }
  ```

Change the `appConfigPath` in `index.html` to the location where you will be deploying your `config.js` file.

  ```html
  ...
  <script type="text/javascript">
    // The path to your configuration file for MetacatUI. This can be any web-accessible location.
    var appConfigPath = "https://my-repo.org/config.js";
  </script>
  ...
  ```

### For MetacatUI v2.11.5 and earlier
See the [config documentation for MetacatUI 2.11.5 and earlier](configuration/pre-2.12.0.html)

> MetacatUI 2.12.0+ can still be configured via index.html like it used to, but that will be deprecated in future releases.
It's recommended that MetacatUI be configured via an external config.js file in v 2.12.0 and later.

## Step 4. DONE!

Go to the installed web location in your web browser (e.g. if you used the Express server above, your install location is http://localhost:3000) and you're ready to use MetacatUI!

## Troubleshooting

See the installation [troubleshooting page](troubleshooting.html).
