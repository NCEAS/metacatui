@startuml

  ' change the default styles

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
  Class SystemMetadata <<Backbone.Model>> {
  }

  Class DataONEObject <<Backbone.Model>> {

  }
  Class DataPackage <<Backbone.Collection>> {
    models : DataONEObject [*]
    model : DataONEObject
    parentPackages : String [*]
    childPackages : String [*]
    initialize() : DataPackage
    sync()
    save()
    fetch()
    destroy()
    update()
    validate()
    toRDF()
  }

}

Package eml {

  Class EML <<Backbone.Model>> {
    access : EMLAccess
    isEditable : Boolean
    alternateIdentifier : String [*]
    shortName : String
    title : String
    creator : EMLParty [*]
    metadataProvider : EMLParty [*]
    associatedParty  : EMLParty [*]
    pubDate : String
    language : String
    series : String
    abstract : String [*]
    keywordSet : EMLKeyword [*]
    additionalInfo : String [*]
    intellectualRights : String [*]
    distribution : EMLDistribution [*]
    coverage : EMLCoverage
    purpose : String [*]
    contact : EMLParty [*]
    publisher : EMLParty [*]
    pubPlace : String
    methods : EMLMethods [*]
    project : EMLProject [*]

    createXML()
  }

  Class EMLViewer <<Backbone.View>> {
  }

  Class EMLParty <<Backbone.Model>> {
    givenName : String [*]
    surName : String
    organizationName : String
    role : String
    createXML() : String
  }

  Class EMLKeyword <<Backbone.Model>> {
    keyword : String
    type : String
    keywordThesaurus : String
    createXML()
  }

  Class EMLDistribution <<Backbone.Model>> {
  }

  Class EMLCoverage <<Backbone.Model>> {

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
DataONEObject <-left- SystemMetadata : describes
EML --o EMLParty: hasModule
EML --o EMLMethods: hasModule
EML --o EMLProject: hasModule
EML --o EMLCoverage: hasModule
EML --o EMLDistribution: hasModule
EML --o EMLKeyword: hasModule
EML --o EMLAccess: hasModule
EML o-- EMLViewer: listensTo

@enduml
