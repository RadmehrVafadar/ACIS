# ACIS Interview Practice

ACIS is a local web app for practicing AI-assisted debugging interviews in a real repository.
The primary workflow is to pick a problem from the library, read the brief, start the timer, reproduce the issue, edit code, and verify the repair.
Django and PostgreSQL are the primary practice stack.
The coach is optional, and an interview can be resumed from its saved attempt.

## Platform

The browser hosts the practice interface and editor.
Docker runs the editable application, database, and tests.
The library opens before a workspace is provisioned.
