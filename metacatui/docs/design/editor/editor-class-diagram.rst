MetacatUI Editor Refactor
=========================

This document provides an overview architecture for incorporating a metadata editor into the MetacatUI web application. The architecture is based off of Backbone Model and View classes.

MetacatUI and EML Modules
-----------------------------

We divide the architecture up into two modules: MetacatUI, and EML.  The EML module will be a standalone Backbone application that is used by the MetacatUI application.  This is experimental - we do see some tight dependencies that might not allow for the separation.

Class Diagram
-------------

..
   @startuml editor-class-diagram.png  

     ' change the default styles   
     skinparam linetype ortho   
     skinparam shadowing false   
     skinparam class {
       BackgroundColor #F5F5F5
       BorderColor #333333
       ArrowColor #333333   
     }   
     skinparam noteFontColor #C49858
     skinparam note {
       BackgroundColor #FCF8E4
       BorderColor #FCEED6   
     }   
     skinparam packageFontColor #9DA0A4
     skinparam package {
       BorderColor #CCCCCC
     }   

     package metacatui {
       together {
         class MediaType {
           + name : String
           + properties : String [*]
         }
       
         note bottom of MediaType
           We may need to delimit property
           K/V pairs with a known delimiter
         end note
         
         class Replica <<Backbone.Model>> {
           + replicaMemberNode : String
           + replicationStatus : String
           + replicaVerified : String
           + validate() : Boolean
           + parse() : Replica
           + toXML() : String
         }
         
         class ReplicationPolicy <<Backbone.Model>> {
           + preferredMemberNodes : String [*]
           + blockedMemberNodes : String [*]
           + replicationAllowed : Boolean
           + numberReplicas : Integer
           + validate() : Boolean
           + parse() : ReplicationPolicy
           + toXML() : String
         }
         
         class AccessRule <<Backbone.Model>> {
           + subject : String [*]
           + permission : String [*]
           + allow : Boolean
           + validate() : Boolean
           + parse() : AccessRule
           + toXML() : String
         }
         
       }
              
       class QualityGuideResults <<Backbone.Model>> {
       }
       
       note bottom
         We'll wait to model the quality guide 
         results until we have a better understanding 
         of the MDQ engine output
       end note
       
       class ScienceMetadata {
         abstract : String [*]
         attribute : String [*]
         attributeDescription : String [*]
         attributeLabel : String [*]
         attributeName : String [*]
         attributeUnit : String [*]
         author : String 
         authorGivenName : String 
         authoritativeMN : String 
         authorLastName : String [*]
         authorSurName : String 
         beginDate : String 
         changePermission : String [*]
         contactOrganization : String [*]
         datasource : String 
         dataUrl : String 
         dateModified : String 
         datePublished : String 
         dateUploaded : String 
         decade : String 
         documents : String [*]
         edition : String 
         endDate : String 
         fileID : String 
         formatType : String 
         gcmdKeyword : String [*]
         investigator : String [*]
         isDocumentedBy : String [*]
         isPublic : String 
         keyConcept : String [*]
         keywords : String [*]
         mediaType : String 
         mediaTypeProperty : String [*]
         origin : String [*]
         originator : String [*]
         placeKey : String [*]
         presentationCat : String 
         project : String 
         pubDate : String 
         purpose : String 
         readPermission : String [*]
         relatedOrganizations : String [*]
         replicaMN : String [*]
         resourceMap : String [*]
         sensor : String [*]
         sensorText : String [*]
         source : String [*]
         scientificName : String [*]
         species : String [*]
         genus : String [*]
         family : String [*]
         class : String [*]
         phylum : String [*]
         order : String [*]
         kingdom : String [*]
         westBoundCoord : String 
         eastBoundCoord : String 
         northBoundCoord : String 
         southBoundCoord : String 
         site : String [*]
         namedLocation : String [*]
         noBoundingBox : String 
         geoform : String 
         isSpatial : String 
         geohash_1 : String [*]
         geohash_2 : String [*]
         geohash_3 : String [*]
         geohash_4 : String [*]
         geohash_5 : String [*]
         geohash_6 : String [*]
         geohash_7 : String [*]
         geohash_8 : String [*]
         geohash_9 : String [*]
         prov_generated : String [*]
         prov_generatedByExecution : String [*]
         prov_generatedByProgram : String [*]
         prov_generatedByUser : String [*]
         prov_hasDerivations : String [*]
         prov_hasSources : String [*]
         prov_instanceOfClass : String [*]
         prov_used : String [*]
         prov_usedByExecution : String [*]
         prov_usedByProgram : String [*]
         prov_usedByUser : String [*]
         prov_wasDerivedFrom : String [*]
         prov_wasExecutedByExecution : String [*]
         prov_wasExecutedByUser : String [*]
         prov_wasInformedBy : String [*]
         sem_annotated_by : String [*]
         sem_annotates : String [*]
         sem_annotation : String [*]
         sem_comment : String [*]
       }
       
       class DataONEObject <<Backbone.UniqueModel>> {
         + serialVersion : String
         + id : String
         + formatId : String
         + size : String
         + checksum: String
         + checksumAlgorithm : String
         + submitter: String
         + rightsHolder : String
         + accessPolicy: AccessRule [*]
         + replicationPolicy : ReplicationPolicy
         + obsoletes : String
         + obsoletedBy : String
         + archived : Boolean
         + dateUploaded : String
         + dateSysMetadataModified : String
         + originMemberNode : String
         + authoritativeMemberNode : String
         + replica : Replica [*]
         + seriesId : String
         + mediaType : MediaType
         + fileName : String
         + nodeLevel : String
         + uploadStatus : String
         + uploadFilePath : String
         + getSystemMetadata() : String
         + validate() : Boolean
         + parse() : DataONEObject
         + toXML() : String
       }
       
       class DataPackage <<Backbone.Collection>> {
         + models : DataONEObject [*]
         + model : DataONEObject
         + childPackages : DataPackage [*]
         - transferQueue : DataONEObject [*]
         + initialize() : DataPackage
         + sync()
         + save()
         + destroy()
         + update()
         + parse() : DataPackage
         - toRDF() : String
       }
       
     }
     package eml {
       class EML <<Backbone.Model>> {
         + isEditable : Boolean
         + alternateIdentifier : String [*]
         + shortName : String
         + title : String
         + creator : EMLParty [*]
         + metadataProvider : EMLParty [*]
         + associatedParty  : EMLParty [*]
         + pubDate : String
         + language : String
         + series : String
         + abstract : String [*]
         + keywordSet : EMLKeyword [*]
         + additionalInfo : String [*]
         + intellectualRights : String [*]
         + onlineDist : EMLOnlineDist [*]
         + offlineDist : EMLOfflineDist [*]
         + geographicCoverages : GeographicCoverage [*]
         + temporalCoverages : TemporalCoverage [*]
         + taxonomicClassifications : Taxon [*]
         + purpose : String [*]
         + contact : EMLParty [*]
         + publisher : EMLParty [*]
         + pubPlace : String
         + methods : EMLMethods [*]
         + project : EMLProject [*]
         + validate() : Boolean
         + parse()  : EML
         + toXML() : String
       }
       
       note left
         For now, we model the EML
         dataset module only. We'll refactor
         to support the software, citation, and
         protocol modules as needed.
       end note
         
       class EMLViewer <<Backbone.View>> {
       }
       
       class EMLParty <<Backbone.Model>> {
         + givenName : String
         + surName : String
         + organizationName : String
         + role : String
         + deliveryPoint : String [*]
         + city : String
         + administrativeArea : String
         + postalCode : String
         + country : String
         + phone : String [*]
         + fax : String [*]
         + electronicMailAddress : String [*]
         + onlineUrl : String [*]
         + userId : String [*]
         + validate() : Boolean
         + parse()  : EMLParty
         + toXML() : String
       }
       
       class EMLKeyword <<Backbone.Model>> {
         + keyword : String
         + type : String
         + keywordThesaurus : String
         + validate() : Boolean
         + parse()  : EMLKeyword
         + toXML() : String
       }
       
       class EMLOnlineDist <<Backbone.Model>> {
         + url : String
         + urlFunction : String (information or download)
         + onlineDescription : String
         + parse() : EMLOnlineDist
         + toXML() : String
       }
       
       class EMLOfflineDist <<Backbone.Model>> {
         + mediumName : String
         + mediumVolume : String
         + mediumFormat : String
         + mediumNote : String
         + parse() : EMLOfflineDist
         + toXML() : String
       }
              
       class GeographicCoverage {
         - data : GeoJSONObject
         + validate() : Boolean
         + toGeoJSON() : String
         + fromGeoJSON() : GeoJSONObject
         + parse() : GeographicCoverage
         + toXML() : String
       }
       
       class TemporalCoverage <<Backbone.Model>> {
         + beginDate : String
         + beginTime : String
         + endDate : String
         + endTime : String
         + validate() : Boolean
         + parse() : TemporalCoverage
         + toXML() : String
       }
       
       note bottom
         We will first only support
         Gregorian dates. We'll change
         the property types from String
         to a subclass when we support
         alternative time scales.
       end note
       
       class Taxon <<Backbone.Model>> {
         + parentId : String
         + taxonomicRank : String
         + taxonomicValue : String
         + commonNames : String [*]
         + validate() : Boolean
         + parse() : Taxon
         + toXML() : String
       }
                
       class EMLMethods <<Backbone.Model>> {
       	 + methodSteps : { title : String, paragraph : String [*] } [*]
       	 + studyExtent : { title : String, paragraph : String [*] } [*]
       	 + samplingDescription : { title : String, paragraph : String [*] } [*]
         + parse() : EMLMethods
         + toXML() : String
       }
       
       class EMLProject <<Backbone.Model>> {
         + title : String
         + funding : String 
         + personnel : EMLParty [*]
         + parse() : EMLProject
         + toXML() : String
       }
       
     }
     
     DataPackage o-- DataONEObject : collectionOf
     DataONEObject <|-- ScienceMetadata : "subclassOf"
     ScienceMetadata <|-- EML : "subclassOf"
     DataONEObject <-- QualityGuideResults : describes
     DataONEObject *-- AccessRule : "contains"
     DataONEObject *-- ReplicationPolicy : "contains"
     DataONEObject *-- Replica : "  contains"
     DataONEObject *-- MediaType : "contains"
     EML *-- EMLParty : "hasModule"
     EML *-- EMLMethods : hasModule
     EML *-- EMLProject : hasModule
     EML *-- GeographicCoverage : "hasModule"
     EML *-- TemporalCoverage : "hasModule"
     EML *-- Taxon : "hasModule"
     EML *-- EMLOnlineDist : hasModule
     EML *-- EMLOfflineDist : hasModule
     EML *-- EMLKeyword : hasModule
     EML <.. EMLViewer : listensTo
     
   @enduml

.. image:: editor-class-diagram.png

Implementation Decisions
------------------------
- A DataONEObject can represent the three types of objects in a DataONE Member Node of Coordinating Node (DATA, METADATA, RESOURCEMAP). A data object will be represented by a DataONEObject with just the SystemMetadata properties populated.  Any science metadata can be represented by a ScienceMetadata subclass of DataONEObject, or an even more specialized subclass of ScienceMetadata (like EML).  While a DataPackage, which models a resource map, isn't a subclass of DataONEObject per se, we'll use a DataONEObject instance to represent it when calling MNStorage API methods for resource maps.
- The DataPackage's standard Backbone.Collection.models property stores the array of DataONEObjects that are directly aggregated by immediate resource map.  For nested packages, the DataPackage.childPackages property stores an array of immediate child packages. Each of these DataPackage Backbone.Collections store their immediate children.
- Each DataONEObject will get assigned a SID and a PID. When publish() is called, we assign a DOI to both the SID and the PID, separately. Citations with SIDs will return the latest data package, citations with PIDs will always return the same DataPackage.
- If we use SIDs as identifiers in the resource maps, when a sub package is changed, the parent packages up the chain will not need to be updated. If we use PIDs, all parent resource maps will need to be updated.
- The DataPackage object will extend Backbone.Collection, and we’ll keep track of both the parent package and the child packages using the Backbone-generated id for the object
- The EML.isEditable property will control whether or not the editor is enabled in the EMLView
- We’ll model the EML modules as minimally as needed, using complex types as needed, like EMLParty
- For now, for we will postpone modeling eml-text, eml-entity modules, and won’t support the maintenance tree
- Instead of modeling EML with its four submodules (dataset, software, citation, protocol, for now we’re keeping the model simple and only supporting EMLDataset
- We won’t support the references tag in `/eml/dataset`
- Object transfers will be queued on a per package basis, using the transferQueue property.  Each DataONEObject item in the queue will have an uploadStatus (queued, transferring, completed, modified). Science metadata that is locally modified, but not 'saved' yet will be in the modified status. Once the save event occurs, it changes to queued and is added to the queue.
