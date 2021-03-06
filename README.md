# pgsql-csv-googlesheet

Bi-directional synchronization of updated rows on PostgreSQL and Google Spreadsheets

# Requirement

The tables to be synchronized are required to have 4 special columns: "id", "uuid", "createdAt" and "updatedAt".

CREATE TABLE sample_table_to_be_sync (
"id" SERIAL PRIMARY KEY,
"uuid" uuid NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
"createdAt" timestamp without time zone NOT NULL DEFAULT now(),
"updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
"title" varchar,
"value" integer
)

# Usage

1. Prepare an empty Google Spreadsheet on your Google Drive.
2. Prepare your initial database image on your PostgreSQL server.
3. Edit 'dbconfig.json'.
4. Download 'client_secret.json' to your current directory by using GoogleConsole.
5. Run 'yarn run oauth' to create 'token.json'.
6. Run 'yarn run merge' to copy initial content from PostgreSQL to Google Spreadsheet. At the first time of access to your Google Drive you are going to be authorized with OAuth2, then client_secret.json and token.json files created/updated in your current directory.
7. Edit the content of Google Spreadsheet.
8. Run 'yarn run merge' to write back your changed rows on Google Spreadsheet to PostgreSQL. The changed rows on PostgreSQL are also affect synchronization.

## Creating new rows

1. Open your Google Spreadsheet file and select a sheet representing a table to be edited.
2. Add a row with initial values including empty cell values of column "id", "uuid", "createdAt" and "updatedAt".
3. Run 'yarn run merge'.

## Updating rows

1. Run 'yarn run merge'.
2. Open your Google Spreadsheet file and select a sheet representing a table to be edited.
3. Edit a row with updated values and set an empty(zero-length-string) value on "updatedAt". You have to leave the values of column "id", "uuid", "createdAt" unchanged.
4. Run 'yarn run merge'.

## Removing rows

1. Run 'yarn run merge'.
2. Open your Google Spreadsheet file and select a sheet representing a table to be edited.
3. Set "-" value in "updatedAt" cell of a row to be removed. You have to leave the values of column "id", "uuid", "createdAt" unchanged.
4. Run 'yarn run merge'.
