"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const moment = require('moment');
const uuidv4 = require('uuid/v4');
const OAuthUtil_1 = require("./OAuthUtil");
const PgUtil_1 = require("./PgUtil");
const SpredsheetUtil_1 = require("./SpredsheetUtil");
const Table_1 = require("./Table");
const COLUMN_NAME_ID = 'id';
const COLUMN_NAME_UUID = 'uuid';
const COLUMN_NAME_CREATED_AT = 'createdAt';
const COLUMN_NAME_UPDATED_AT = 'updatedAt';
const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED = '';
const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_UPDATED = '';
const CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_REMOVED = '-';
const getColIndex = (table) => {
    const idColIndex = table.fields.findIndex(field => field.name == COLUMN_NAME_ID);
    const uuidColIndex = table.fields.findIndex(field => field.name == COLUMN_NAME_UUID);
    const createdAtColIndex = table.fields.findIndex(field => field.name == COLUMN_NAME_CREATED_AT);
    const updatedAtColIndex = table.fields.findIndex(field => field.name == COLUMN_NAME_UPDATED_AT);
    return { idColIndex, uuidColIndex, createdAtColIndex, updatedAtColIndex };
};
exports.mergeSheetAndDB = async (tokenPath, clientSecretPath, scope, spreadsheetId, dbconfig) => {
    const auth = await OAuthUtil_1.oauth(tokenPath, clientSecretPath, 'web', scope);
    exports.mergeSheetAndDBWithAuth(auth, spreadsheetId, dbconfig);
};
exports.mergeSheetAndDBWithAuth = async (auth, spreadsheetId, dbconfig) => {
    const sheet = await SpredsheetUtil_1.createSheetAPIClient(auth);
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
    const tablesFromDB = (await PgUtil_1.readTablesFromDB(dbconfig)).filter((tableFromDB) => {
        const { idColIndex, uuidColIndex, createdAtColIndex, updatedAtColIndex, } = getColIndex(tableFromDB);
        if (idColIndex == -1 ||
            uuidColIndex == -1 ||
            createdAtColIndex == -1 ||
            updatedAtColIndex == -1) {
            return false;
        }
        return true;
    });
    // console.log("DB: "+JSON.stringify(tablesFromDB, null, 2));
    const sheetTitleIdRelations = await SpredsheetUtil_1.fetchSheetTitleIdRelations(sheet, spreadsheetId);
    // console.log("SheetID: "+JSON.stringify(sheetTitleIdRelations, null, 2));
    const tablesFromSheets = (await SpredsheetUtil_1.readTablesFromSheets(sheet, spreadsheetId, sheetTitleIdRelations)).filter(table => !!table);
    const mustBeRemovedUUIDTables = [];
    // console.log("SHEET: "+JSON.stringify(tablesFromSheets, null, 2));
    const now = moment().format('YYYY-MM-DD HH:mm:ss.SSSSSS');
    const tables = tablesFromDB.map((tableFromDB) => {
        const valuesFromSheetMap = {};
        const valuesFromDBMap = {};
        const uuid2idMap = {};
        const mustBeRemovedUUIDs = {};
        let intersection;
        const values = [];
        const { idColIndex, uuidColIndex, createdAtColIndex, updatedAtColIndex, } = getColIndex(tableFromDB);
        tableFromDB.values.forEach((rowValues) => {
            const uuid = rowValues[uuidColIndex];
            valuesFromDBMap[uuid] = rowValues;
            uuid2idMap[uuid] = rowValues[idColIndex];
        });
        const tableFromSheet = tablesFromSheets.find(tableFromSheet => tableFromSheet.name == tableFromDB.name);
        // console.log("tableFromSheet:"+tableFromSheet);
        if (tableFromSheet && 0 < tableFromSheet.values.length) {
            tableFromSheet.values.forEach((rowValues, rowIndex) => {
                let id = rowValues[idColIndex];
                if (id == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED &&
                    tableFromDB.values &&
                    tableFromDB.values[rowIndex] &&
                    tableFromDB.values[rowIndex][idColIndex]) {
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
                if (id != CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED &&
                    updatedAt ==
                        CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_REMOVED) {
                    mustBeRemovedUUIDs[uuid] = true;
                }
                else {
                    if (createdAt == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_INSERTED) {
                        rowValues[createdAtColIndex] = now;
                    }
                    if (updatedAt == CELL_VALUE_OF_MARK_THIS_ROW_TO_BE_UPDATED) {
                        rowValues[updatedAtColIndex] = now;
                    }
                }
                valuesFromSheetMap[uuid] = rowValues;
            });
            intersection = _.intersection(Object.keys(valuesFromSheetMap), Object.keys(valuesFromDBMap));
            intersection.forEach(uuid => {
                if (mustBeRemovedUUIDs[uuid]) {
                    console.log('DB x x x SH', tableFromSheet.name, uuid);
                    return;
                }
                const valueFromDB = valuesFromDBMap[uuid];
                const valueFromSheet = valuesFromSheetMap[uuid];
                const updatedAtDB = moment(valueFromDB[updatedAtColIndex])
                    .toDate()
                    .getTime();
                const updatedAtSheet = moment(valueFromSheet[updatedAtColIndex])
                    .toDate()
                    .getTime();
                if (updatedAtDB == updatedAtSheet) {
                    // console.log('DB ===== SH', tableFromSheet.name, uuid);
                    values.push(valueFromSheet);
                    return;
                }
                else if (updatedAtDB < updatedAtSheet) {
                    // console.log(' < < < < SH', tableFromSheet.name, uuid);
                    values.push(valueFromSheet);
                    return;
                }
                else {
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
        }
        else {
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
        return new Table_1.Table(tableFromDB.name, tableFromDB.fields, values, tableFromDB.maxSequenceValue++);
    });
    // console.log("RESULT: "+JSON.stringify(tables, null, 2));
    // mkdir(outdir);
    // createCSVFiles(tables, outdir);
    //
    // const mustBeRemovedUUIDTableRows: {tableFromDB: Table, mustBeRemovedUUIDs: any} = {};
    mustBeRemovedUUIDTables.map(async (mustBeRemovedUUIDTable) => await PgUtil_1.deleteRowsTablesOnDB(dbconfig, mustBeRemovedUUIDTable.table, mustBeRemovedUUIDTable.mustBeRemovedUUIDs));
    await PgUtil_1.insertOrUpdateTablesOnDB(dbconfig, tables);
    await SpredsheetUtil_1.insertOrUpdateTablesOnSheets(sheet, spreadsheetId, tables);
};
//# sourceMappingURL=MergeUtil.js.map