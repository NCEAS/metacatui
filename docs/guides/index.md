# Customizing your MetacatUI app

The following is a list of How To guides for customizing the display and functionality
of your MetacatUI application. Is something missing? [Email us](mailto:metacat-dev@ecoinformatics.org) or join us on [Slack](https://slack.dataone.org/) and we'll add it.

## Define a default Access Policy

When data files, metadata documents, and resource maps are uploaded to your repository
through the MetacatUI dataset editor, each upload is assigned a [DataONE Access Policy](https://releases.dataone.org/online/api-documentation-v2.0.1/apis/Types.html#Types.AccessPolicy). Access Policies define who can view, edit, or edit ownership of an object.

To define the default Access Policy of objects uploaded to your repository,
define a [`defaultAccessPolicy` configuration option](../docs/AppConfig.html#defaultAccessPolicy) in the `AppConfig` object.

#### Examples:
- Make all objects publicly viewable

  ```js
    defaultAccessPolicy: [{
      subject: "public",
      read: true,
      write: false,
      changePermission: false
    }]
  ```
- Make all objects private

  ```js
    defaultAccessPolicy: [{
      subject: "public",
      read: false,
      write: false,
      changePermission: false
    }]
  ```

- Make all objects private but give an administrative group access to view, edit, and edit ownership

  ```js
    defaultAccessPolicy: [{
      subject: "public",
      read: false,
      write: false,
      changePermission: false
    },
    {
      subject: "CN=data-admins,DC=dataone,DC=org", //Your admin group ID/subject
      read: true,
      write: true,
      changePermission: true
    }]
  ```
