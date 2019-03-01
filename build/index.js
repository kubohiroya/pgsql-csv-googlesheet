"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mkdir_1 = require("./lib/mkdir");
const OAuthUtil_1 = require("./lib/OAuthUtil");
const PgUtil_1 = require("./lib/PgUtil");
const SpredsheetUtil_1 = require("./lib/SpredsheetUtil");
const MergeUtil_1 = require("./lib/MergeUtil");
const pg_1 = require("pg");
exports.SCOPE_SPREADSHEET = [
    'https://www.googleapis.com/auth/spreadsheets',
];
exports.fetch = async (tokenPath, cientSecretPath, scope, spreadsheetId, dbconfig) => {
    const auth = await OAuthUtil_1.oauth(tokenPath, cientSecretPath, scope);
    const sheets = await SpredsheetUtil_1.createSheetAPIClient(auth);
    const sheetTitleIdRelations = await SpredsheetUtil_1.fetchSheetTitleIdRelations(sheets, spreadsheetId);
    const tablesFromSheet = await SpredsheetUtil_1.readTablesFromSheets(sheets, spreadsheetId, sheetTitleIdRelations);
    const tablesFromDB = await PgUtil_1.readTablesFromDB(dbconfig);
    const fieldMap = {};
    tablesFromDB.forEach((tableFromDB) => {
        tableFromDB.fields.forEach(field => fieldMap[`${tableFromDB.name},${field.name}`] = field);
    });
    tablesFromSheet.map((tableFromSheet) => {
        tableFromSheet.fields = tableFromSheet.fields.map(field => fieldMap[`${tableFromSheet.name},${field}`]);
    });
    await PgUtil_1.clearDB(dbconfig);
    await PgUtil_1.insertOrUpdateTablesOnDB(dbconfig, tablesFromSheet);
    console.log('done.');
};
exports.post = async (tokenPath, clientSecretPath, scope, spreadsheetId, dbconfig // srcdir: string,
) => {
    const auth = await OAuthUtil_1.oauth(tokenPath, clientSecretPath, scope);
    // const csvFileList: string[] = await getCsvFileList(srcdir);
    // const tables: Table[] = await readTablesFromCSVFiles(srcdir, csvFileList);
    const tables = await PgUtil_1.readTablesFromDB(dbconfig);
    const sheets = await SpredsheetUtil_1.createSheetAPIClient(auth);
    await SpredsheetUtil_1.insertOrUpdateTablesOnSheets(sheets, spreadsheetId, tables);
    console.log('done.');
};
exports.dump = async (dbconfig, outdir) => {
    try {
        mkdir_1.mkdir(outdir);
        const client = new pg_1.Client(dbconfig);
        await client.connect();
        await Promise.all(PgUtil_1.dumpDBToCSV(outdir).map(async ({ statement, args }) => {
            return client.query(statement, args);
        }));
        await client.end();
        console.log('done.');
    }
    catch (err) {
        console.error(err);
    }
};
exports.clear = async (dbconfig) => {
    await PgUtil_1.clearDB(dbconfig);
};
exports.restore = async (dbconfig, srcdir) => {
    try {
        const client = new pg_1.Client(dbconfig);
        await client.connect();
        await Promise.all(PgUtil_1.restoreDBFromCSV(srcdir, dbconfig.tables).map(async ({ statement, args }) => {
            return client.query(statement, args);
        }));
        await client.end();
        console.log('done.');
    }
    catch (err) {
        console.error(err);
    }
};
exports.merge = async (tokenPath, clientSecretPath, spreadsheetId, dbconfig) => {
    MergeUtil_1.mergeSheetAndDB(tokenPath, clientSecretPath, exports.SCOPE_SPREADSHEET, spreadsheetId, dbconfig);
};
exports.auth = async (tokenPath, clientSecretPath) => {
    return OAuthUtil_1.oauth(tokenPath, clientSecretPath, ['https://www.googleapis.com/auth/spreadsheets']);
};
//# sourceMappingURL=index.js.map