"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const SheetTitleIdRelation_1 = require("./SheetTitleIdRelation");
const Table_1 = require("./Table");
exports.createSheetAPIClient = (auth) => {
    return new Promise(resolve => {
        return resolve(googleapis_1.google.sheets({ version: 'v4', auth }));
    });
};
exports.fetchSheetTitleIdRelations = async (sheets, spreadsheetId) => {
    return new Promise((resolve, reject) => {
        sheets.spreadsheets.get({
            spreadsheetId,
        }, (err, res) => {
            if (err) {
                return reject('[fetchSheetTitleIdRelations] The API returned an error: ' +
                    err);
            }
            else {
                const sheetTitleIDMaps = res.data.sheets
                    .filter((sheet) => {
                    return sheet.properties.sheetId != 0;
                })
                    .map((sheet) => {
                    const sheetTitle = sheet.properties.title;
                    const sheetId = sheet.properties.sheetId;
                    return new SheetTitleIdRelation_1.SheetTitleIdRelation(sheetTitle, sheetId);
                });
                return resolve(sheetTitleIDMaps);
            }
        });
    });
};
exports.readTablesFromSheets = (sheets, spreadsheetId, sheetTitleIdRelations) => {
    return Promise.all(sheetTitleIdRelations.map((sheetTitleIdRelation) => {
        return new Promise((resolve, reject) => {
            sheets.spreadsheets.values.get({
                spreadsheetId,
                range: sheetTitleIdRelation.sheetTitle,
            }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                const fields = res.data.values &&
                    res.data.values.length > 0 &&
                    res.data.values[0];
                const values = res.data.values &&
                    res.data.values.length > 1 &&
                    res.data.values.splice(1);
                if (fields && values) {
                    return resolve(new Table_1.Table(sheetTitleIdRelation.sheetTitle, fields.map((f) => { name: f; }), values, -1));
                }
                else {
                    return resolve();
                }
            });
        });
    }));
};
function createGridProperties(table) {
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
const addSheets = (sheets, spreadsheetId, tables) => {
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
    const addSheets = tables.reverse().map((table, index) => {
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
    const requests = addSheets; // deleteSheets.concat(addSheets);
    if (addSheets.length == 0) {
        return;
    }
    return new Promise((resolve, reject) => {
        return sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests,
            },
        }, (err, res) => {
            if (err) {
                return reject('[ensureSheets] The API returned an error: ' +
                    err +
                    '\n' +
                    JSON.stringify(requests, null, 2));
            }
            return resolve();
        });
    });
};
exports.insertOrUpdateSheets = (sheets, spreadsheetId, tables, sheetTitleIdMap) => {
    const updateSheetProps = tables.map((table) => {
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
    const updateCells = tables.map((table) => {
        if (table.values.length == 0) {
        }
        return {
            updateCells: {
                rows: [table.fields.map(field => field.name)]
                    .concat((table.values.length != 0) ? table.values : [Array(table.fields.length).fill('')])
                    .map((row) => {
                    return {
                        values: row.map((cell) => {
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
    const requests = updateSheetProps.concat(updateCells);
    return new Promise((resolve, reject) => {
        return sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests,
            },
        }, (err, res) => {
            if (err) {
                console.log(JSON.stringify(requests, null, '   '));
                return reject('[updateSheets] The API returned an error: ' + err);
            }
            return resolve();
        });
    });
};
exports.insertOrUpdateTablesOnSheets = async (sheets, spreadsheetId, tables) => {
    let sheetTitleIdRelations;
    sheetTitleIdRelations = await exports.fetchSheetTitleIdRelations(sheets, spreadsheetId);
    const sheetTitleIdMap = {};
    sheetTitleIdRelations.map((sheetProperties) => {
        sheetTitleIdMap[sheetProperties.sheetTitle] = sheetProperties.sheetId;
    });
    // console.log("@@@@@@@@",sheetIdMap);
    await addSheets(sheets, spreadsheetId, tables.filter(table => !sheetTitleIdMap[table.name]));
    sheetTitleIdRelations = await exports.fetchSheetTitleIdRelations(sheets, spreadsheetId);
    await exports.insertOrUpdateSheets(sheets, spreadsheetId, tables, sheetTitleIdMap);
};
//# sourceMappingURL=SpredsheetUtil.js.map