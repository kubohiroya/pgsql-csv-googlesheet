/*
    "oauth":   "ts-node src/oauth.ts",
    "dump":    "ts-node src/dump.ts  $npm_package_config_dumpconfig $npm_package_config_dumpdir",
    "clear":   "ts-node src/clear.ts $npm_package_config_dbconfig",
    "restore": "ts-node src/restore.ts $npm_package_config_dbconfig $npm_package_config_restoredir",
    "fetch":   "ts-node src/fetch.ts $npm_package_config_tokenPath $npm_package_config_clientSecretPath $npm_package_config_spreadsheetId $npm_package_config_restoredir",
    "post":    "ts-node src/post.ts  $npm_package_config_tokenPath $npm_package_config_clientSecretPath $npm_package_config_spreadsheetId $npm_package_config_dumpdir",
    "merge":   "ts-node src/merge.ts $npm_package_config_tokenPath $npm_package_config_clientSecretPath $npm_package_config_spreadsheetId $npm_package_config_dumpdir $npm_package_config_restoredir"
    */
import { oauth } from './lib/OAuthUtil';
import { mkdir } from './lib/mkdir';
import {clearDB, dumpDBToCSV, restoreDBFromCSV, readTablesFromDB, insertOrUpdateTablesOnDB} from './lib/PgUtil';
import {
    createCSVFiles,
    readTablesFromCSVFiles,
    getCsvFileList,
} from './lib/CsvUtil';
import { SheetTitleIdRelation } from './lib/SheetTitleIdRelation';
import {
    createSheetAPIClient,
    fetchSheetTitleIdRelations, insertOrUpdateTablesOnSheets,
    readTablesFromSheets,
} from './lib/SpredsheetUtil';
import { mergeSheetAndDB } from './lib/MergeUtil';

import { Table } from './lib/Table';

import {Client, FieldDef} from 'pg';
export const SCOPE_SPREADSHEET: string[] = [
    'https://www.googleapis.com/auth/spreadsheets',
];

export type DBConfig = {
    "host": string,
    "user": string,
    "password": string,
    "database": string,
    "port": number,
    "tables": string[]
}

export const fetch = async (
    tokenPath: string,
    cientSecretPath: string,
    scope: string[],
    spreadsheetId: string,
    dbconfig: DBConfig
) => {
    const auth = await oauth(tokenPath, cientSecretPath, scope);
    const sheets = await createSheetAPIClient(auth);
    const sheetTitleIdRelations: SheetTitleIdRelation[] = await fetchSheetTitleIdRelations(
        sheets,
        spreadsheetId,
    );
    const tablesFromSheet: Table[] = await readTablesFromSheets(
        sheets,
        spreadsheetId,
        sheetTitleIdRelations,
    );
    const tablesFromDB: Table[] = await readTablesFromDB(dbconfig);

    const fieldMap: {[key:string]: FieldDef} = {};
    tablesFromDB.forEach((tableFromDB: Table)=> {
        tableFromDB.fields.forEach(field => fieldMap[`${tableFromDB.name},${field.name}`] = field);
    });

    tablesFromSheet.map((tableFromSheet)=>{
        tableFromSheet.fields = tableFromSheet.fields.map(field=>fieldMap[`${tableFromSheet.name},${field}`])
    });

    await clearDB(dbconfig)
    await insertOrUpdateTablesOnDB(dbconfig, tablesFromSheet);
    console.log('done.');
};

export const post = async (
    tokenPath: string,
    clientSecretPath: string,
    scope: string[],
    spreadsheetId: string,
    dbconfig:DBConfig // srcdir: string,
) => {
    const auth = await oauth(tokenPath, clientSecretPath, scope);
    // const csvFileList: string[] = await getCsvFileList(srcdir);
    // const tables: Table[] = await readTablesFromCSVFiles(srcdir, csvFileList);
    const tables: Table[] = await readTablesFromDB(dbconfig);
    const sheets = await createSheetAPIClient(auth);
    await insertOrUpdateTablesOnSheets(
        sheets,
        spreadsheetId,
        tables
    );
    console.log('done.');
};

export const dump = async (dbconfig: DBConfig, outdir: string) => {
    try {
        mkdir(outdir);
        const client = new Client(dbconfig);
        await client.connect();
        await Promise.all(dumpDBToCSV(outdir).map(
                async ({ statement, args }) => {
                    return client.query(statement, args);
                },
            ),
        );
        await client.end();
        console.log('done.');
    } catch (err) {
        console.error(err);
    }
};

export const clear = async (dbconfig: DBConfig) => {
    await clearDB(dbconfig);
};

export const restore = async (dbconfig: DBConfig, srcdir: string) => {
    try {
        const client = new Client(dbconfig);
        await client.connect();
        await Promise.all(
            restoreDBFromCSV(srcdir, dbconfig.tables).map(async ({ statement, args }) => {
                return client.query(statement, args);
            }),
        );
        await client.end();
        console.log('done.');
    } catch (err) {
        console.error(err);
    }
};

export const merge =  async (tokenPath: string,
        clientSecretPath: string,
        spreadsheetId: string,
        dbconfig: DBConfig) => {
  mergeSheetAndDB(
        tokenPath,
        clientSecretPath,
        SCOPE_SPREADSHEET,
        spreadsheetId,
        dbconfig
  );
};
