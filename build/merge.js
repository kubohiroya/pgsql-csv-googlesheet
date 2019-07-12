"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const MergeUtil_1 = require("./lib/MergeUtil");
const tokenPath = process.env.npm_package_config_tokenPath || process.argv[2];
const clientSecretPath = process.env.npm_package_config_clientSecretPath || process.argv[3];
const spreadsheetId = process.env.npm_package_config_spreadsheetId || process.argv[4];
const dbconfig = require(process.env.npm_package_config_dbconfig ||
    process.argv[5]);
try {
    MergeUtil_1.mergeSheetAndDB(tokenPath, clientSecretPath, 'installed', index_1.SCOPE_SPREADSHEET, spreadsheetId, dbconfig);
}
catch (err) {
    console.error(err);
}
//# sourceMappingURL=merge.js.map