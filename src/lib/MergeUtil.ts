import * as _ from 'lodash';
const moment = require('moment');

const uuidv4 = require('uuid/v4');

import { mkdir } from './mkdir';
import { oauth } from './OAuthUtil';
import {
  deleteRowsTablesOnDB,
  insertOrUpdateTablesOnDB,
  readTablesFromDB,
  resetSequence,
} from './PgUtil';
import { SheetTitleIdRelation } from './SheetTitleIdRelation';
import {
  createSheetAPIClient,
  fetchSheetTitleIdRelations,
  insertOrUpdateTablesOnSheets,
  readTablesFromSheets,
} from './SpredsheetUtil';
import { Table } from './Table';

const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED = '';
const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_UPDATED = '';
const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_REMOVED = '-';

const getColIndex = (table: Table) => {
  return _.fromPairs(table.fields.map((f, index) => [f.name,index]))
};

export const mergeSheetAndDB = async (
  tokenPath: string,
  clientSecretPath: string,
  type: string,
  scope: string[],
  spreadsheetId: string,
  dbconfig: any,
) => {
  const auth = await oauth(tokenPath, clientSecretPath, type, scope);
  mergeSheetAndDBWithAuth(auth, spreadsheetId, dbconfig);
};

const regulateRowValues = (dbFieldNames: string[], sheetColIndex: {[fieldName: string]: number}, values: any[]) : any[] => {
  return dbFieldNames.map((fieldName: string)=>values[sheetColIndex[fieldName]]);
};

export const mergeSheetAndDBWithAuth = async (
  auth: any,
  spreadsheetId: string,
  dbconfig: any,
) => {
  const sheet = await createSheetAPIClient(auth);

  /*
    const csvFileList: string[] = await getCsvFileList(srcdir);
    const tablesFromCSV: Table[] = (await readTablesFromCSVFiles(
        srcdir,
        csvFileList,
    )).filter((tableFromCSV: Table, index: number) => {
        const {
            idColIndex,
            uuidColIndex,
            createdAtColIndex,
            updatedAtColIndex,
        } = getColIndex(tableFromCSV);
        if (
            idColIndex == -1 ||
            uuidColIndex == -1 ||
            createdAtColIndex == -1 ||
            updatedAtColIndex == -1
        ) {
            return false;
        }
        return true;
    });*/

  const tablesFromDB = (await readTablesFromDB(dbconfig)).filter(
    (tableFromDB: Table) => {
      const {
        id,
        uuid,
        createdAt,
        updatedAt,
      } = getColIndex(tableFromDB);
      if (
        id == -1 ||
        uuid == -1 ||
        createdAt == -1 ||
        updatedAt == -1
      ) {
        return false;
      }
      return true;
    },
  );

  // console.log("DB: "+JSON.stringify(tablesFromDB, null, 2));

  const sheetTitleIdRelations: SheetTitleIdRelation[] = await fetchSheetTitleIdRelations(
    sheet,
    spreadsheetId,
  );
  // console.log("SheetID: "+JSON.stringify(sheetTitleIdRelations, null, 2));

  const tablesFromSheets: Table[] = (await readTablesFromSheets(
    sheet,
    spreadsheetId,
    sheetTitleIdRelations,
  )).filter(table => !!table);

  const mustBeRemovedUUIDTables: any[] = [];
  // console.log("SHEET: "+JSON.stringify(tablesFromSheets, null, 2));
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSSSSS');

  const tables: Table[] = tablesFromDB.map((tableFromDB: Table) => {
    const valuesFromSheetMap: { [key: string]: string[] } = {};
    const valuesFromDBMap: { [key: string]: string[] } = {};
    const uuid2idMap: { [key: string]: string } = {};
    const mustBeRemovedUUIDs: { [key: string]: boolean } = {};
    let intersection: string[];
    const values: any[][] = [];

    const dbColIndex = getColIndex(tableFromDB);
    const dbFieldNames = tableFromDB.fields.map((f)=>f.name);

    const idColIndex = dbColIndex.id;
    const uuidColIndex = dbColIndex.uuid;
    const updatedAtColIndex = dbColIndex.updatedAt;
    const createdAtColIndex = dbColIndex.createdAt;

    tableFromDB.values.forEach((rowValues: string[]) => {
      const uuid = rowValues[uuidColIndex];
      valuesFromDBMap[uuid] = rowValues;
      uuid2idMap[uuid] = rowValues[idColIndex];
    });

    const tableFromSheet: Table | undefined = tablesFromSheets.find(
      tableFromSheet => tableFromSheet.name == tableFromDB.name,
    );

    if (tableFromSheet && 0 < tableFromSheet.values.length) {
      const sheetColIndex = getColIndex(tableFromSheet);
      tableFromSheet.values.forEach((rowValues: any[], rowIndex: number) => {
        let id = rowValues[idColIndex];
        if (
          id == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED &&
          tableFromDB.values &&
          tableFromDB.values[rowIndex] &&
          tableFromDB.values[rowIndex][idColIndex]
        ) {
          id = tableFromDB.values[rowIndex][idColIndex];
          rowValues[idColIndex] = id;
        }
        let uuid = rowValues[uuidColIndex];
        if (uuid == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED) {
          uuid = uuidv4();
          rowValues[uuidColIndex] = uuid;
        }
        const createdAt = rowValues[createdAtColIndex];
        const updatedAt = rowValues[updatedAtColIndex];

        if (
          id != CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED &&
          updatedAt == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_REMOVED
        ) {
          mustBeRemovedUUIDs[uuid] = true;
        } else {
          if (createdAt == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED) {
            rowValues[createdAtColIndex] = now;
          }
          if (updatedAt == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_UPDATED) {
            rowValues[updatedAtColIndex] = now;
          }
        }
        valuesFromSheetMap[uuid] = rowValues;
      });

      intersection = _.intersection(
        Object.keys(valuesFromSheetMap),
        Object.keys(valuesFromDBMap),
      );
      intersection.forEach(uuid => {
        if (mustBeRemovedUUIDs[uuid]) {
          console.log('DB x x x SH', tableFromSheet.name, uuid);
          return;
        }

        const valueFromDB = valuesFromDBMap[uuid];
        const valueFromSheet = regulateRowValues(dbFieldNames, sheetColIndex, valuesFromSheetMap[uuid]);
        const updatedAtDB: number = moment(valueFromDB[updatedAtColIndex])
          .toDate()
          .getTime();
        const updatedAtSheet: number = moment(valueFromSheet[updatedAtColIndex])
          .toDate()
          .getTime();

        if (updatedAtDB == updatedAtSheet) {
          // console.log('DB ===== SH', tableFromSheet.name, uuid);
          values.push(valueFromSheet);
          return;
        } else if (updatedAtDB < updatedAtSheet) {
          // console.log(' < < < < SH', tableFromSheet.name, uuid);
          values.push(valueFromSheet);
          return;
        } else {
          values.push(valueFromDB);
          // console.log('DB > > > > ', tableFromDB.name, uuid);
          return;
        }
      });
      _.pullAll(Object.keys(valuesFromSheetMap), intersection).forEach(uuid => {
        if (!mustBeRemovedUUIDs[uuid]) {
          console.log('DB < < <SH', tableFromSheet.name, uuid);
          values.push(valuesFromSheetMap[uuid]);
        }
      });
    } else {
      intersection = [];
    }

    // console.log("1 ... "+JSON.stringify(valuesFromDBMap, null, " " ))
    // console.log("2 ... "+JSON.stringify(intersection, null, " " ))

    _.pullAll(Object.keys(valuesFromDBMap), intersection).forEach(uuid => {
      if (!mustBeRemovedUUIDs[uuid]) {
        console.log('DB> > > SH', tableFromDB.name, uuid);
        values.push(valuesFromDBMap[uuid]);
      }
    });
    mustBeRemovedUUIDTables.push({ table: tableFromDB, mustBeRemovedUUIDs });
    return new Table(
      tableFromDB.name,
      tableFromDB.fields,
      values,
      tableFromDB.maxSequenceValue++,
    );
  });

  // console.log("RESULT: "+JSON.stringify(tables, null, 2));
  // mkdir(outdir);
  // createCSVFiles(tables, outdir);
  //
  // const mustBeRemovedUUIDTableRows: {tableFromDB: Table, mustBeRemovedUUIDs: any} = {};

  mustBeRemovedUUIDTables.map(
    async (mustBeRemovedUUIDTable: any) =>
      await deleteRowsTablesOnDB(
        dbconfig,
        mustBeRemovedUUIDTable.table,
        mustBeRemovedUUIDTable.mustBeRemovedUUIDs,
      ),
  );

  await insertOrUpdateTablesOnDB(dbconfig, tables);
  await insertOrUpdateTablesOnSheets(sheet, spreadsheetId, tables);
};
