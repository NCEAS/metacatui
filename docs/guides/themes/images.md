# Customizing theme images

## Favicon

Theme favicons are located in the `img/img/favicons` directory inside your theme directory.
The favicon URLs are set in the `appHead.html` template, but it is recommended that you **do not** override this template
in your theme. Instead, name your favicons according to the file names below.

```
  /mytheme
     /img
        /favicons
           /manifest.json
           /favicon.ico
           /apple-icon-57x57.png
           /apple-icon-60x60.png
           /apple-icon-72x72.png
           /apple-icon-76x76.png
           /apple-icon-114x114.png
           /apple-icon-120x120.png
           /apple-icon-144x144.png
           /apple-icon-152x152.png
           /apple-icon-180x180.png
           /android-icon-192x192.png
           /favicon-32x32.png
           /favicon-96x96.png
           /favicon-16x16.png
```

## Header images

![{{ site.url }}](/assets/images/navbar-background-imgs.png)

The default MetacatUI theme shows a rotation of images in the top header. The images
are randomly shuffled through with each page load.

### Changing the header images

#### Step 1. Add new images to your theme

These images are located in the `img/backgrounds` directory inside your theme directory.

- The image file names need to start with `bg` and the numbers `1` to `n`, where `n` is the number of total images.
- The file extensions need to be `.jpg`

Example:

```
  /mytheme
     /img
        /backgrounds
           /bg1.jpg
           /bg2.jpg
           /bg3.jpg
```

#### Step 2. Update the image count in the navbar template

The `navbar.html` template contains the HTML element that displays these images. In
order for the images to show up correctly, this element needs two components:

1. The `id` attribute must equal `bg_image`.
2. The `data-image-count` attribute must equal the number of image files that you added in Step 1. e.g. `data-image-count="3"`

### Removing the header images

Whatever element in MetacatUI that contains the `id` `bg_image` (`#bg_image`) will display these images.
Simply remove or rename elements with that `id`. By default, the `navbar.html` template contains that element.
