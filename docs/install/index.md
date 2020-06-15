# Installing MetacatUI for your Metacat repository

## Step 1. Download MetacatUI

[Download the latest version of MetacatUI](https://github.com/NCEAS/metacatui/releases) and unzip it.

Note: If you have a `metacatui.war` file from Metacat, then you can unpack that war file instead, since it is the
same as downloading MetacatUI from Github. However, there may be a newer version of MetacatUI on Github than what
is bundled in the Metacat release.

## Step 2. Configure MetacatUI

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
      mapsKey: "YOUR-GOOGLE-MAPS-KEY"
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

## Step 3. Configure Apache for MetacatUI

Follow the steps in the [Apache configuration instructions](apache).

Then, move the MetacatUI files in the `src` directory to the Apache web directory. Example:

  ```bash
   cd metacatui-2.11.2
   mv -rf src/* /var/www/
  ```

## Step 4. DONE!

Go to the URL of your MetacatUI, as configured in Apache in Step 3, and you're done!

## Troubleshooting

See the installation [troubleshooting page](troubleshooting.md).
