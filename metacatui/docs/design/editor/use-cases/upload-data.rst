Upload Data         
===========

Scenario
--------

    As a scientist, I want to upload multiple files to the data repository so I can share them publicly and with colleagues.
    
Summary
-------
A scientist should be able to upload multiple files to the server by choosing them from their file system.  The goal is to provide batch upload of large numbers of files (100s to ~1000).  The application should queue each file and process the uploads sequentially, possibly with multiple connections for parallel uploads.  The display should allow scrolling through a table of files with their upload status.  For uploads with large counts, the table should be responsive and not bog down the display.  The metadata should be updated to reflect basic information about the file (name, size, online link, etc.). The package describing the data and metadata should also be updated. While uploads are occurring, the scientist should be able to edit other metadata fields.  

Mockup Image
------------

.. image:: images/Edit-Metadata-Queued-Files.png

Technical Sequence Diagram
--------------------------

.. 
    @startuml images/upload-data-sequence-diagram.png
      !include ../plantuml-styles.txt
      skinparam SequenceGroupBorderColor #AAAAAA
      skinparam SequenceGroupBorderThickness #AAAAAA
      actor "Scientist"
      participant "DataPackageView" as DPViewer <<Backbone.View>>
      participant "DataPackage" as DataPackageObject <<DataONEObject>>
      participant "MetadataObject" as MetadataObject  <<DataONEObject>>
      participant "DataObject" as DataObject  <<DataONEObject>>
      participant "MN" as MN  <<MemberNode>>
      DPViewer -> DPViewer : listenTo("click menu.item", handleUpload())
      Scientist -> DPViewer : chooses "Add files ..." menu item
      activate DPViewer
        DPViewer --> Scientist : file upload dialog
      deactivate DPViewer
      Scientist --> DPViewer : selects upload FileList
      activate DPViewer
      DPViewer -> DPViewer : handleUpload(event, FileList)
      DPViewer -> DPViewer : parentPackage = getParentPackage(id)
      DPViewer -> DPViewer : parentMetadata = getParentMetadata(id)
      loop for File in FileList
        DPViewer -> DataObject : new()
        activate DataObject
          DataObject --> DPViewer : dataObject
        deactivate DataObject
          DPViewer -> DPViewer : dataObject.set(uploadStatus, 'Queued')
          DPViewer -> DPViewer : dataObject.set(uploadFile, File)
      end
      deactivate DPViewer
    @enduml

.. image:: images/upload-data-sequence-diagram.png
