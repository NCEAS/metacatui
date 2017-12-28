Update Metadata     
===============     

Scenario
--------

    As a scientist, I want to update the metadata descriptions of an existing dataset so I can provide more context about the dates, locations, procedures, and other aspects of my data.
    
Mockup Image
--------
.. image:: ../images/Edit-Metadata-Overview.png

Technical Sequence Diagram
--------------------------
.. @startuml images/edit-metadata-sequence-diagram.png

	!include ../plantuml-styles.txt
    skinparam SequenceGroupBorderColor #AAAAAA
    skinparam SequenceGroupBorderThickness #AAAAAA
 
    actor "Scientist"
    participant MetadataView as MetadataView <<Backbone.View>>
	participant MetadataTextView as MetadataTextView <<Backbone.View>>
	participant editButton as editButton <<DOMElement>>
	participant inputText as inputText <<DOMElement>>
	participant EML as EML <<Backbone.Model>>
	participant saveButton as saveButton <<DOMElement>>
	participant DataONEObject as DataONEObject <<Backbone.Model>>
	
	Scientist -> MetadataView : lands on dataset page
	
	activate MetadataView
		MetadataView -> saveButton : listenTo("click")
		MetadataView -> MetadataTextView : new()
		activate MetadataTextView
			MetadataTextView -> editButton : listenTo("click")
			MetadataTextView -> MetadataView : MetadataTextView
		deactivate MetadataTextView
		MetadataView -> Scientist : Metadata Web Page
	deactivate MetadataView

		
	Scientist -> editButton : clicks edit button
	activate editButton
		editButton -> MetadataTextView : trigger
	deactivate editButton
	activate MetadataTextView
		MetadataTextView -> inputText : show()
		MetadataTextView -> inputText : listenTo("focusout")
		MetadataTextView -> Scientist : Shows input element
	deactivate MetadataTextView
		
	Scientist -> inputText : Edits content of input elements
	activate inputText
		Scientist -> inputText : Focusout
		inputText -> MetadataTextView : trigger
	deactivate inputText
	
	activate MetadataTextView	
		MetadataTextView -> EML : set(attribute)
	deactivate MetadataTextView
	
	Scientist -> saveButton : clicks Save
	activate saveButton
	saveButton -> EML : trigger
	deactivate saveButton
	
	activate EML
		EML -> EML : toXML()
		EML -> DataONEObject : save()
	deactivate EML
	

	@enduml


.. image:: images/edit-metadata-sequence-diagram.png
