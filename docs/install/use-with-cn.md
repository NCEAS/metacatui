# Installing MetacatUI locally to use with a remote DataONE Coordinating Node

## Step 1. Clone MetacatUI
- Clone the MetacatUI git repository:

```
git clone https://github.com/NCEAS/metacatui.git
```

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
      //Your Google Maps API key, for map features
      mapsKey: "YOUR-GOOGLE-MAPS-KEY",
      //Choose the dataone theme, which is already set up with all the CN values
      theme: "dataone"
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
See the [config documentation for MetacatUI 2.11.5 and earlier](configuration/pre-2.12.0.html) but
make the following adjustments to Step 1 (index.html):

  - Set the `data-theme` to `dataone`.
  - Remove the value of `data-metacat-context` since DataONE CN URLs do not have a metacat directory

> MetacatUI 2.12.0+ can still be configured via index.html like it used to, but that will be deprecated in future releases.
It's recommended that MetacatUI be configured via an external config.js file in v 2.12.0 and later.

## Step 3. Set up a web server
Follow Step 2 from the ["Installing MetacatUI locally for development"](local.html#step-2-set-up-a-local-web-server) instructions to configure a web server on your local machine, or follow the [Apache configuration instructions](apache.html) if you already have Apache installed.

## Step 4. DONE!

Go to the installed web location in your web browser (e.g. if you used the Express server above, your install location is http://localhost:3000) and you're ready to use MetacatUI!

## Troubleshooting

See the installation [troubleshooting page](troubleshooting.md).
