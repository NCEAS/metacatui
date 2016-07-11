..
  @startuml images/editor-design-metacatui-package.png
  !include plantuml-styles.txt
  
  ' override the linetype
  skinparam linetype ortho   
  
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
        + uploadFile : File
        + getSystemMetadata() : String
        + validate() : Boolean
        + parse() : DataONEObject
        + toXML() : String
      }
      
      note right
        The HTML5 File API doesn't
        allow file access via the 
        full path, but only from a
        File instance. This may affect
        persisted, incomplete uploads
        stored in localStorage.
      end note
      
      class DataPackage <<Backbone.Collection>> {
        + models : DataONEObject [*]
        + model : DataONEObject
        + childPackages : DataPackage [*]
        - transferQueue : DataONEObject [*]
        + editable : Boolean
        + initialize() : DataPackage
        + sync()
        + save()
        + destroy()
        + update()
        + parse() : DataPackage
        - toRDF() : String
      }
      
      class DataPackageView {
        - handleUpload()
      }
      note left
        A DataPackageView represents the
        table of items in the data package
      end note
      
      class DataItemView {
      }
      note left
        A DataItemView represents a single row
        view in the DataPackageView table
      end note
    }
    
    DataPackage o-- DataONEObject : collectionOf
    DataPackage <.right. DataPackageView : listensTo
    DataONEObject <.right. DataItemView : listensTo
    DataONEObject <|-- ScienceMetadata : "subclassOf"
    DataONEObject <-- QualityGuideResults : describes
    DataONEObject *-- AccessRule : "contains"
    DataONEObject *-- ReplicationPolicy : "contains"
    DataONEObject *-- Replica : "  contains"
    DataONEObject *-- MediaType : "contains"
    
  
  @enduml