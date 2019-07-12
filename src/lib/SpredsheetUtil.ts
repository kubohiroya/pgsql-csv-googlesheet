import { google } from 'googleapis';
import * as _ from 'lodash';
import { SheetTitleIdRelation } from './SheetTitleIdRelation';
import { Table } from './Table';
import { FieldDef } from 'pg';

export const createSheetAPIClient = (auth: any) => {
    return new Promise(resolve => {
        return resolve(google.sheets({ version: 'v4', auth }));
    });
};

export const fetchSheetTitleIdRelations = async (
    sheets: any,
    spreadsheetId: string,
): Promise<SheetTitleIdRelation[]> => {
    return new Promise<SheetTitleIdRelation[]>((resolve: any, reject: any) => {
        sheets.spreadsheets.get(
            {
                spreadsheetId,
            },
            (err: any, res: any) => {
                if (err) {
                    return reject(
                        '[fetchSheetTitleIdRelations] The API returned an error: ' +
                            err,
                    );
                } else {
                    const sheetTitleIDMaps: SheetTitleIdRelation[] = res.data.sheets
                        .filter((sheet: any) => {
                            return sheet.properties.sheetId != 0;
                        })
                        .map((sheet: any) => {
                            const sheetTitle = sheet.properties.title;
                            const sheetId = sheet.properties.sheetId;
                            return new SheetTitleIdRelation(
                                sheetTitle,
                                sheetId,
                            );
                        });
                    return resolve(sheetTitleIDMaps);
                }
            },
        );
    });
};

export const readTablesFromSheets = (
    sheets: any,
    spreadsheetId: string,
    sheetTitleIdRelations: SheetTitleIdRelation[],
) => {
    return Promise.all<Table>(
        sheetTitleIdRelations.map(
            (sheetTitleIdRelation: SheetTitleIdRelation) => {
                return new Promise<Table>((resolve, reject) => {
                    sheets.spreadsheets.values.get(
                        {
                            spreadsheetId,
                            range: sheetTitleIdRelation.sheetTitle,
                        },
                        (err: any, res: any) => {
                            if (err) {
                                return reject(err);
                            }
                            const fields =
                                res.data.values &&
                                res.data.values.length > 0 &&
                                res.data.values[0];
                            const values =
                                res.data.values &&
                                res.data.values.length > 1 &&
                                res.data.values.splice(1);
                            if (fields && values) {
                                return resolve(
                                    new Table(
                                        sheetTitleIdRelation.sheetTitle,
                                        fields.map((f:string)=> {name:f}),
                                        values,
                                        -1,
                                    ),
                                );
                            } else {
                                return resolve();
                            }
                        },
                    );
                });
            },
        ),
    );
};

function createGridProperties(table: Table) {
    return table.values.length == 0
        ? {
              frozenRowCount: 1,
              rowCount: 2,
              columnCount: table.fields.length,
          }
        : {
              frozenRowCount: 1,
              rowCount: table.values.length + 1,
              columnCount: table.fields.length,
          };
}

const addSheets = (sheets: any, spreadsheetId: string, tables: Table[]) => {
    /*
    const deleteSheets: any[] = _.union(
        _.intersection(
            Object.keys(sheetTitleMap),
            tables.map(table => table.name),
        ),
    ).map((sheetName: string) => {
        return {
            deleteSheet: {
                sheetId: sheetTitleMap[sheetName],
            },
        };
    });
    */

    const addSheets: any[] = tables.reverse().map((table: Table, index) => {
        const gridProperties = createGridProperties(table);
        return {
            addSheet: {
                properties: {
                    title: table.name,
                    gridProperties,
                },
            },
        };
    });

    const requests: any[] = addSheets; // deleteSheets.concat(addSheets);
    if (addSheets.length == 0) {
        return;
    }
    return new Promise<void>((resolve: any, reject: any) => {
        return sheets.spreadsheets.batchUpdate(
            {
                spreadsheetId,
                resource: {
                    requests,
                },
            },
            (err: any, res: any) => {
                if (err) {
                    return reject(
                        '[ensureSheets] The API returned an error: ' +
                            err +
                            '\n' +
                            JSON.stringify(requests, null, 2),
                    );
                }
                return resolve();
            },
        );
    });
};

export const insertOrUpdateSheets = (
    sheets: any,
    spreadsheetId: string,
    tables: Table[],
    sheetTitleIdMap: { [key: string]: number },
) => {
    const updateSheetProps: any[] = tables.map((table: Table) => {
        const gridProperties = createGridProperties(table);
        const sheetId = sheetTitleIdMap[table.name];
        return {
            updateSheetProperties: {
                properties: {
                    sheetId,
                    title: table.name,
                    gridProperties,
                },
                fields: '*',
            },
        };
    });
    const updateCells: any[] = tables.map((table: Table) => {

        if(table.values.length == 0){

        }


        return {
            updateCells: {
                rows: [table.fields.map(field => field.name)]
                    .concat( (table.values.length != 0) ? table.values : [Array(table.fields.length).fill('')])
                    .map((row: any) => {
                        return {
                            values: row.map((cell: any) => {
                                switch (typeof cell) {
                                    case 'object':
                                        return {
                                            userEnteredValue: {
                                                stringValue: cell,
                                            },
                                        };
                                    case 'number':
                                        return {
                                            userEnteredValue: {
                                                numberValue: cell,
                                            },
                                        };
                                    case 'boolean':
                                        return {
                                            userEnteredValue: {
                                                boolValue: cell,
                                            },
                                        };
                                    default:
                                        return {
                                            userEnteredValue: {
                                                stringValue: cell,
                                            },
                                        };
                                }
                            }),
                        };
                    }),
                fields: '*',
                start: {
                    sheetId: sheetTitleIdMap[table.name],
                    columnIndex: 0,
                    rowIndex: 0,
                },
            },
        };
    });

    const requests: any[] = updateSheetProps.concat(updateCells);

    return new Promise<void>((resolve: any, reject: any) => {
        return sheets.spreadsheets.batchUpdate(
            {
                spreadsheetId,
                resource: {
                    requests,
                },
            },
            (err: any, res: any) => {
                if (err) {
                    console.log(JSON.stringify(requests, null, '   '));
                    return reject(
                        '[updateSheets] The API returned an error: ' + err,
                    );
                }
                return resolve();
            },
        );
    });
};

export const insertOrUpdateTablesOnSheets = async (
    sheets: any,
    spreadsheetId: string,
    tables: Table[],
) => {
    let sheetTitleIdRelations: SheetTitleIdRelation[];
    sheetTitleIdRelations = await fetchSheetTitleIdRelations(
        sheets,
        spreadsheetId,
    );

    const sheetTitleIdMap: { [key: string]: number } = {};
    sheetTitleIdRelations.map((sheetProperties: any) => {
        sheetTitleIdMap[sheetProperties.sheetTitle] = sheetProperties.sheetId;
    });

    // console.log("@@@@@@@@",sheetIdMap);

    await addSheets(
        sheets,
        spreadsheetId,
        tables.filter(table => !sheetTitleIdMap[table.name]),
    );

    sheetTitleIdRelations = await fetchSheetTitleIdRelations(
        sheets,
        spreadsheetId,
    );

    await insertOrUpdateSheets(sheets, spreadsheetId, tables, sheetTitleIdMap);
};
