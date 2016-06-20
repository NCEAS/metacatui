@startuml

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

Package metacatui {
  together {

    Class MediaType {
      + name : String
      + properties : String [*]
    }

  note bottom of MediaType: "We may need to delimit property \nK/V pairs with a known delimiter"
    
    Class Replica <<Backbone.Model>> {
      + replicaMemberNode : String
      + replicationStatus : String
      + replicaVerified : String
      + validate() : Boolean
      + toXML() : String
    }

    Class ReplicationPolicy <<Backbone.Model>> {
      + preferredMemberNodes : String [*]
      + blockedMemberNodes : String [*]
      + replicationAllowed : Boolean
      + numberReplicas : Integer
      + validate() : Boolean
      + toXML() : String
    }

    Class AccessRule <<Backbone.Model>> {
      + subject : String [*]
      + permission : String [*]
      + validate() : Boolean
      + toXML() : String
    }
    
  }
  
  Class SystemMetadata <<Backbone.Model>> {
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

  Class DataONEObject <<Backbone.Model>> {

  }
  
  Class DataPackage <<Backbone.Collection>> {
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

Package eml {

  Class EML <<Backbone.Model>> {
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
  note left : "For now, we model the EML \ndataset module only. We'll refactor \nto support the software, citation, and \nprotocol modules as needed."

  Class EMLViewer <<Backbone.View>> {
  }

  Class EMLParty <<Backbone.Model>> {
    + givenName : String [*]
    + surName : String
    + organizationName : String
    + role : String
    + toXML() : String
    + validate() : Boolean
    + toXML() : String
  }

  Class EMLKeyword <<Backbone.Model>> {
    + keyword : String
    + type : String
    + keywordThesaurus : String
    + validate() : Boolean
    + toXML() : String
  }

  Class EMLDistribution <<Backbone.Model>> {
  }

  Class EMLCoverage <<Backbone.Model>> {
    + geographicCoverages : GeographicCoverage [*]
    + temporalCoverages : TemporalCoverage [*]
    + taxanomicCoverages : TaxonomicCoverage [*]
	  + validate() : Boolean
    + toGeoJSON() : GeoJSONObject
	  + toXML() : String
    + fromXML() : EMLCoverage
  }
  together {
    Class GeographicCoverage {
      - data : GeoJSONObject
      + validate() : Boolean
      + toGeoJSON() : String
      + fromGeoJSON() : GeoJSONObject
      + toXML() : String
      + fromXML() : GeographicCoverage
    }
    
    Class TemporalCoverage {
      + beginDate : String
      + beginTime : String
      + endDate : String
      + endTime : String
      + toXML() : String
      + fromXML() : TemporalCoverage
    }
  
    note bottom : "We will first only support \nGregorian dates. We'll change \nthe property types from String\n to a subclass when we support \nalternative time scales."
    
    Class TaxonomicCoverage {
    }
  }
  
  Class EMLMethods <<Backbone.Model>> {
  }

  Class EMLProject <<Backbone.Model>> {
  }

  Class EMLAccess <<Backbone.Model>> {
  }
}

DataPackage o-- DataONEObject : collectionOf
DataONEObject <|-- EML : subclassOf
DataONEObject <-right- SystemMetadata : describes
SystemMetadata *-right- AccessRule : contains
SystemMetadata *-- ReplicationPolicy : contains
SystemMetadata *-- Replica : contains
SystemMetadata *-- MediaType : contains


EML *-- EMLParty : hasModule
EML *-- EMLMethods : hasModule
EML *-- EMLProject : hasModule
EML *-- EMLCoverage : hasModule
EMLCoverage *-- GeographicCoverage : contains
EMLCoverage *-- TemporalCoverage : contains
EMLCoverage *-- TaxonomicCoverage : contains
EML *-- EMLDistribution : hasModule
EML *-- EMLKeyword : hasModule
EML *-- EMLAccess : hasModule
EML <.. EMLViewer : listensTo

@enduml
