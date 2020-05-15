
### Setting a default access policy for uploads
In the `AppModel.js`, set the default access policy via the `defaultAccessPolicy` attribute. The default access policy is an array of literal objects
with the following attributes:
`subject`, `read`, `write`, and `changePermission`.

The values of these attributes will be serialized to the system metadata of each object uploaded via the MetacatUI editor.
Example access policy that makes all objects publicly readable:
```Javascript
[{
	subject: "public",
	read: true,
	write: false,
	changePermission: false
}]
```

This access policy will be serialized into the system metadata as:
```xml
	<accessPolicy>
		<allow>
			<subject>public</subject>
			<permission>read</permission>
		</allow>
	</accessPolicy>
```
