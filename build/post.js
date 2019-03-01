"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tokenPath = process.env.npm_package_config_tokenPath || process.argv[2];
const clientSecretPath = process.env.npm_package_config_clientSecretPath || process.argv[3];
const spreadsheetId = process.env.npm_package_config_spreadsheetId || process.argv[4]; //'1kUmIAFn65t8Zw1D87LevTCH4jUTPX1lN8jC_sy_3cDQ',
const dbconfig = require(process.env.npm_package_config_dbconfig ||
    process.argv[5]);
const index_1 = require("./index");
index_1.post(tokenPath, clientSecretPath, index_1.SCOPE_SPREADSHEET, spreadsheetId, dbconfig);
//# sourceMappingURL=post.js.map