Archive a File      
==============

Scenario
--------

    As a scientist, I want to archive a file so it is no longer associated with newer versions of my dataset and it will not be discoverable, but will remain citable.

Summary
-------
A scientist should be able to archive a file, which is similar to deleting a file, but preserves read access in the event the file has been directly cited.  The goal is to enable archiving of data files, as well as data packages that contain the data files.  The display should immediately remove the items that are archived, and they should be asychronously archived in the repository. For uploads with large counts, the table should be responsive and not bog down the display.  If only a data file is archived, the science metadata and containing package should be updated to reflect this. 

Mockup Image
------------

.. image:: images/Edit-Metadata-Archive-a-File.png

Technical Sequence Diagram
--------------------------



