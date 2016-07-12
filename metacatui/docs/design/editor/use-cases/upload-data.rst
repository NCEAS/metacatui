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
      participant DataPackageView as PackageView <<Backbone.View>>
      participant DataPackage as DataPackage <<Backbone.Collection>>
      participant Metadata as Metadata <<DataONEObject>>
      participant DataObject as DataObject  <<DataONEObject>>
      participant dataObject as "dataObject:DataObject"  <<DataONEObject>>
      participant LocalStorage as LocalStore  <<Store>>
      participant MN as MN  <<Store>>

      note right of LocalStore
        Any changes to a DataONEObject
        are persisted to the LocalStore
        using Backbone.UniqueModel
      end note
      PackageView -> DataPackage : listenTo("add", handleAdd())
      DataPackage -> DataPackage : on("add", handleAdd())

      PackageView -> PackageView : on("click menu.item", handleUpload())
      Scientist -> PackageView : chooses "Add files ..." menu item

      activate PackageView
        PackageView --> Scientist : file upload dialog
      deactivate PackageView

      Scientist --> PackageView : selects upload FileList
      activate PackageView

        PackageView -> PackageView : handleUpload(event, FileList)
        PackageView -> DataPackage : set("editable", false)
        note left
          Editing is disabled
        end note
        PackageView -> DataPackage : listenTo("change:editable", handleEditable())

        note left
          DataPackageView gets the 
          parent package and parent 
          metadata based on the 
          event.target
        end note
        
        loop for File in FileList
          |||
          PackageView -> DataObject : dataObject = new()
          deactivate PackageView
          
          activate DataObject
            DataObject --> PackageView : dataObject
          deactivate DataObject
          
          activate PackageView
          PackageView -> dataObject : set({nodeLevel: parentLevel + 1, uploadStatus: 'Queued', uploadFile: File})
          deactivate PackageView
          
          activate dataObject
            dataObject --> PackageView: dataObject
          deactivate dataObject
          
          activate PackageView
            PackageView -> DataPackage : queueObject(dataObject)
          deactivate PackageView
                    
          activate DataPackage
            DataPackage -> DataPackage : add(dataObject)
            DataPackage -> DataPackage : dataObject = transferQueue.shift()
            DataPackage -> DataPackage : handleAdd(dataObject)
            DataPackage -> Metadata : addEntity(dataObject)
          deactivate DataPackage
            
          activate Metadata
            Metadata --> DataPackage : success
          deactivate Metadata
          
          activate DataPackage  
            PackageView -> PackageView : handleAdd()
            
            note left
              When an object is queued, the DataPackageView and 
              DataPackage listen to "request", "sync", and "error" 
              events emitted by the DataObject during save() (not depicted)
            end note
            
            DataPackage -> dataObject : save()
          deactivate DataPackage
          
          activate dataObject
            dataObject -> MN : create(pid, sysmeta, object)
          deactivate dataObject
          
          activate MN
            MN --> dataObject : identifer
          deactivate MN
          
          activate dataObject  
            dataObject -> MN : getSystemMetadata()
          deactivate dataObject
          
          activate MN
            MN --> dataObject : sysmeta
          deactivate MN
          
          activate dataObject
            dataObject -> dataObject : updateSystemMetadata()
            dataObject -> dataObject : set("uploadStatus", "Complete")
            
            note left
              We don't want to emit the
              "sync" event until the
              DataObject properties are
              completely updated
            end note
            dataObject -> dataObject : trigger("sync")
          deactivate dataObject
          activate DataPackage
            DataPackage -> DataPackage : handleSync()
            PackageView -> PackageView : handleSync()
            note left
              The row DataItemView changes 
              the upload status
            end note
            DataPackage -> Metadata : save()
          deactivate DataPackage
          
          activate Metadata
            Metadata -> MN : update(pid, newPid, sysmeta, object)
          deactivate Metadata
          
          activate MN
            MN --> Metadata : identifier
          deactivate MN
          
          activate Metadata
            Metadata -> MN : getSystemMetadata(pid)
          deactivate Metadata
          
          activate MN
            MN --> Metadata : sysmeta
          deactivate MN
          
          activate Metadata
            Metadata -> Metadata : updateSystemMetadata()
            Metadata -> Metadata : set("uploadStatus", "Complete")
            Metadata -> Metadata : trigger("sync")
          deactivate Metadata
          
          activate DataPackage
            DataPackage -> DataPackage : handleSync()
            DataPackage -> MN : update(pid, newPid, sysmeta, object)
          deactivate DataPackage
          
          activate MN
            MN --> DataPackage : identifier
          deactivate MN
          activate DataPackage
          
        end
            DataPackage --> PackageView : handleEditable()
            note left
              Editing is enabled
            end note
          deactivate DataPackage
      
    @enduml

.. image:: images/upload-data-sequence-diagram.png
