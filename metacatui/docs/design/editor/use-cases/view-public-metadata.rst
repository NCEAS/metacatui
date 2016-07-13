View Public Metadata
====================

Scenario
--------

    As a member of the public, I want to view metadata descriptions about a dataset so I can easily understand the context of where, when, and how the data were collected or used.

Mockup Image
------------

.. image:: images/editor-design-view-metadata.png

Technical Sequence Diagram
--------------------------

@startuml images/view-public-metadata-sequence-diagram.png

	!include ../plantuml-styles.txt
	skinparam SequenceGroupBorderColor #AAAAAA
	skinparam SequenceGroupBorderThickness #AAAAAA
	
	actor "Scientist"
	participant MetadataView as MetadataView <<Backbone.View>>
	participant DataONEObject as DataONEObject <<Backbone.Model>>
	participant EML as EML <<Backbone.Model>>
	participant EMLView as EMLView <<Backbone.View>>
	participant DataPackage as DataPackage <<Backbone.Collection>>
	participant DataPackageView as DataPackageView <<Backbone.View>>
	
	Scientist -> MetadataView : lands on page
	activate MetadataView
		MetadataView -> DataONEObject : fetch(id)
		activate DataONEObject
			DataONEObject --> MetadataView : dataOneObject
			MetadataView -> DataONEObject : get("formatId")
			DataONEObject --> MetadataView : "eml"
		deactivate DataONEObject
			MetadataView -> EML : new()
		activate EML
			EML --> MetadataView : emlObject
		deactivate EML
			MetadataView -> EMLView : render(emlObject)
	deactivate MetadataView
		
	activate EMLView	
		EMLView -> DataPackage : new([emlObject])
		activate DataPackage
			DataPackage --> EMLView : package
		deactivate DataPackage
		EMLView -> DataPackageView : render(DataPackage)
		activate DataPackageView
			DataPackageView --> EMLView :  DOM Element
		deactivate DataPackageView
	deactivate EMLView
	
@enduml

.. image:: images/view-public-metadata-sequence-diagram.png
