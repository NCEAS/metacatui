# MetacatUI Themes

MetacatUI comes with a few themes already installed: `default`, `knb`, `arctic`, and `dataone`.
The `default` theme can be used out-of-box. It is recommended since it has an unbranded style and has is configured for general use. The other themes are included as examples, but are very repository-specific.

## Creating a custom theme

The look and feel of your MetacatUI can be customized by creating a custom theme.

The basic components of a custom theme are:

1. A navigation bar at the top of the page (`navbar.html` template)
2. A footer at the bottom of the page (`footer.html` template)
3. Custom CSS so you can use your own colors, fonts, etc.
4. A configuration file for the theme

To create a custom theme, do the following:

### Step 1. Copy the default theme as a starting point

Copy and paste the `js/themes/default` directory to a new directory with the name of
your theme:

```bash
cp -rf src/js/themes/default src/js/themes/{my-theme-name}
```

Where `{my-theme-name}` is replaced with your chosen theme name.

### Step 2. Create a `templates` directory:

```bash
mkdir src/js/themes/{my-theme-name}/templates
```

### Step 3. Customize the default navbar and footer templates

```bash
cp src/js/templates/navbar.html src/js/themes/{my-theme-name}/templates/navbar.html
cp src/js/templates/footer.html src/js/themes/{my-theme-name}/templates/footer.html
```

Open up the navbar.html and footer.html files in a text editor and change the HTML
so that it shows the links, logo, and other content you'd like.

Simple Javascript can be used in these templates. It may also be useful to use the `MetacatUI.root` variable,
which is the root path of your MetacatUI installation, taken directly from `src/loader.js`.

For example, to add your organization's logo, put your logo file in `src/js/themes/{my-theme-name}/img/` and add
HTML for the logo to a template:

```
<a href="http://nceas.ucsb.edu" target="_blank">
  <img alt="NCEAS" src="<%=MetacatUI.root%>/js/themes/{my-theme-name}/img/nceas-logo.png">
</a>
```

**Note:** The `navbar` template contains links that you will want to keep in your custom `navbar` template,
such as links to "My profile" and "My datasets" when a user is logged in, the "Sign In" button, etc.
Proceed carefully with this template. You may just want to update the logo image and leave the rest intact, to start with.

### Step 4. Customize CSS

In `src/js/themes/{my-theme-name}/css/metacatui.css` and `src/js/themes/{my-theme-name}/css/metacatui.responsive.css`,
you can add or edit any CSS to make your theme branded the way you'd like.

**Note:** These CSS files must be named `metacatui.css` and `metacatui.responsive.css`

### Step 5. Create a configuration file to tie it all together

The last piece that glues all your custom theme parts together is your theme `config.js` file. Open the `config.js` file
in a text editor and in the `themeMap` json variable, add a new line for every template you have customized for your new theme.
What this does is map the default location of these app components to the customized location in your theme directory.

An example for the `footer.html` and `navbar.html` files is below. Your CSS does not need to be included here.

```js
MetacatUI.themeMap = {
  "*": {
    // example overrides are provided here
    "templates/navbar.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/navbar.html",
    "templates/footer.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/footer.html",
  },
};
```

You can also include app configuration for this theme by defining a `MetacatUI.AppConfig` variable with
configuration options. For example, if you want your theme to always use a certain `emailContact`, you can specify that configuration value like so:

```js
MetacatUI.AppConfig = Object.assign(
  {
    emailContact: "contact@ourrepo.org",
  },
  MetacatUI.AppConfig || {},
);
```

You could use this `AppConfig` as your primary application configuration by setting the [`appConfigPath`](../docs/global.html#appConfigPath)
to this file path. Or it can be used as additional configurations on top of a primary configuration file.

## Advanced customization by extending models and views

All the models, collections, views, routers, and templates required to run
MetacatUI are in the `js` directory. Any of these files can be extended by your custom
theme to provide additional functionality on top of the default MetacatUI functionality.

> **Warning**
> While extending models and views is supported, we suggest that you proceed carefully,
> because:

- Your customizations may break after updating MetacatUI to a new version. You may need to make manual changes to get them working again.
- If you completely override a function inside of a model or view, you might break something.

That being said, please feel free to extend MetacatUI as much as you'd like! If you
make an extension that you think would be useful to other MetacatUI users, we suggest
you make a Pull Request to MetacatUI so your code can be merged into the MetacatUI source code.
This is mutually beneficial, since your code will be maintained by the MetacatUI dev team,
meaning you have less maintenance to do!

- Submit a [pull request](https://github.com/NCEAS/metacatui/compare)
- More details on [contributing](https://github.com/NCEAS/metacatui/blob/master/CONTRIBUTING.md).

### How to extend a model or view

#### Step 1. Make a file for the extended component

Create a directory and file in your theme directory. It's helpful to keep the same
file organization as the source code by creating a `model`, `view`, or other subdirectory inside your theme directory.

For example, say we want to extend the `TextView`:

```bash
mkdir src/js/themes/{my-theme-name}/views
touch src/js/themes/{my-theme-name}/views/TextView.js
```

#### Step 2. Add the extended component to your themeMap

Continuing the TextView example:
First, we want to override the name of the `views/TextView` component. In your `src/js/themes/{my-theme-name}/config.js`
file, edit the `themeMap` variable.
Add a line for the base `TextView` and rename it something like `views/BaseTextView`:

```js
"views/BaseTextView" : MetacatUI.root + "/js/views/TextView.js",
```

**What does this do?** This maps a new component, `views/BaseTextView`, in the application to the `/js/views/TextView.js` file. If you were to stop here, you would see no change in MetacatUI, since the `views/BaseTextView` component isn't used by any view in the app.

Next, add a line that maps your extended `TextView` to the `views/TextView` name:

```js
"views/TextView" : MetacatUI.root + "/js/themes/" + MetacatUI.theme + "/views/TextView.js",
```

**What does this do?** This maps the existing component,`views/TextView`, to the custom `TextView.js` file
that we created in Step 1. (If you were to stop here, your TextView would break and throw errors because your
theme `TextView.js` file is empty.)

#### Step 3. Create your extended component

Continuing the TextView example, we would edit the view so that it `requires` the `views/BaseTextView` component
(the base TextView that we are extending), along with any other components we want to use, such as jQuery, Backbone, etc.

Then we create and return a Backbone view that `extend`s the `BaseTextView`.

Then we add the custom functionality to the view. In this example, we just added a function that
logs "Hello world!" to the console.

```js
define(["jquery", "underscore", "backbone", "views/BaseTextView"], function (
  $,
  _,
  Backbone,
  BaseTextView,
) {
  "use strict";

  var TextView = BaseTextView.extend({
    myNewFunction: function () {
      console.log("Hello world!");
    },
  });
  return TextView;
});
```

#### Step 4. Done!

You should be able to run your custom theme and see that both the base component and the extended component are
loaded into the app.
