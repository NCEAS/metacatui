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
           + toXML() : String
         }
         
         class ReplicationPolicy <<Backbone.Model>> {
           + preferredMemberNodes : String [*]
           + blockedMemberNodes : String [*]
           + replicationAllowed : Boolean
           + numberReplicas : Integer
           + validate() : Boolean
           + toXML() : String
         }
         
         class AccessRule <<Backbone.Model>> {
           + subject : String [*]
           + permission : String [*]
           + validate() : Boolean
           + toXML() : String
         }
         
       }
       
       class SystemMetadata <<Backbone.Model>> {
         + serialVersion : String
         + identifier : String
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
         + validate() : Boolean
         + toXML() : String
       }
       
       class DataONEObject <<Backbone.Model>> {
       }
       
       class DataPackage <<Backbone.Collection>> {
         + models : DataONEObject [*]
         + model : DataONEObject
         + parentPackages : String [*]
         + childPackages : String [*]
         + initialize() : DataPackage
         + sync()
         + save()
         + fetch()
         + destroy()
         + update()
         + validate() : Boolean
         + toRDF()
       }
       
     }
     package eml {
       class EML <<Backbone.Model>> {
         + access : EMLAccess
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
         + distribution : EMLDistribution [*]
         + coverage : EMLCoverage
         + purpose : String [*]
         + contact : EMLParty [*]
         + publisher : EMLParty [*]
         + pubPlace : String
         + methods : EMLMethods [*]
         + project : EMLProject [*]
         + validate() : Boolean
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
         + givenName : String [*]
         + surName : String
         + organizationName : String
         + role : String
         + toXML() : String
         + validate() : Boolean
         + toXML() : String
       }
       
       class EMLKeyword <<Backbone.Model>> {
         + keyword : String
         + type : String
         + keywordThesaurus : String
         + validate() : Boolean
         + toXML() : String
       }
       
       class EMLDistribution <<Backbone.Model>> {
       }
       
       class EMLCoverage <<Backbone.Model>> {
         + geographicCoverages : GeographicCoverage [*]
         + temporalCoverages : TemporalCoverage [*]
         + taxanomicCoverages : TaxonomicCoverage [*]
         + validate() : Boolean
         + toGeoJSON() : GeoJSONObject
         + toXML() : String
         + fromXML() : EMLCoverage
       }
       
       together {
         class GeographicCoverage {
           - data : GeoJSONObject
           + validate() : Boolean
           + toGeoJSON() : String
           + fromGeoJSON() : GeoJSONObject
           + toXML() : String
           + fromXML() : GeographicCoverage
         }
         
         class TemporalCoverage {
           + beginDate : String
           + beginTime : String
           + endDate : String
           + endTime : String
           + toXML() : String
           + fromXML() : TemporalCoverage
         }
         
         note bottom
           We will first only support
           Gregorian dates. We'll change
           the property types from String
           to a subclass when we support
           alternative time scales.
         end note
         
         class TaxonomicCoverage {
           taxonomicClassifications : Taxon [*]
         }
         
         class Taxon {
           + parentId : String
           + taxonomicRank : String
           + taxonomicValue : String
           + commonNames : String [*]
         }
         
       }
       
       class EMLMethods <<Backbone.Model>> {
       }
       
       class EMLProject <<Backbone.Model>> {
       }
       
       class EMLAccess <<Backbone.Model>> {
       }
       
     }
     DataPackage o-- DataONEObject : collectionOf
     DataONEObject <|-- EML : "          subclassOf"
     DataONEObject <-right- SystemMetadata : describes
     SystemMetadata *-right- AccessRule : "                        contains"
     SystemMetadata *-- ReplicationPolicy : "    contains"
     SystemMetadata *-- Replica : "  contains"
     SystemMetadata *-- MediaType : "            contains"
     EML *-- EMLParty : "                                                    hasModule"
     EML *-- EMLMethods : hasModule
     EML *-- EMLProject : hasModule
     EML *-- EMLCoverage : hasModule
     EMLCoverage *-- GeographicCoverage : "                    contains"
     EMLCoverage *-- TemporalCoverage : "    contains"
     EMLCoverage *-- TaxonomicCoverage : "contains"
     TaxonomicCoverage *-- Taxon : "    contains"
     EML *-- EMLDistribution : hasModule
     EML *-- EMLKeyword : hasModule
     EML *-- EMLAccess : hasModule
     EML <.. EMLViewer : listensTo
     
   @enduml

.. image:: editor-class-diagram.png

Implementation Decisions
------------------------
- Each DataONEObject will get assigned a SID and a PID. When publish() is called, we assign a DOI to both the SID and the PID, separately. Citations with SIDs will return the latest data package, citations with PIDs will always return the same DataPackage.
- The DataPackage object will extend Backbone.Collection, and we’ll keep track of both the parent package and the child packages using the Backbone-generated id for the object
- The EML.isEditable property will control whether or not the editor is enabled in the EMLView
- We’ll model the EML modules as minimally as needed, using complex types as needed, like EMLParty
- For now, for we will postpone modeling eml-text, eml-entity modules, and won’t support the maintenance tree
- Instead of modeling EML with its four submodules (dataset, software, citation, protocol, for now we’re keeping the model simple and only supporting EMLDataset
- We won’t support the references tag in ``/eml/dataset`
