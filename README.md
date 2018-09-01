# pgsql-csv-googlesheet
Bi-directional synchronization of updated rows on PostgreSQL and Google Spreadsheets

# Requirement

The tables to be synchronizeded are required to have 'id', 'uuid', 'createdAt', 'updatedAt' columns.

# Usage
1. Prepare an empty Google Spreadsheet on your Google Drive.
2. Prepare yuor initial database image on your PostgreSQL server.
3. Edit 'dbconfig.json'.
4. run 'yarn run merge'.
