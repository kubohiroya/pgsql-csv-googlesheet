"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const oauthUtil_1 = require("./lib/oauthUtil");
const tokenPath = process.env.npm_package_config_tokenPath || process.argv[2] || 'token.json';
const clientSecretPath = process.env.npm_package_config_clientSecretPath ||
    process.argv[3] ||
    './client_secret.json';
const scope = (process.env.npm_package_config_scope ||
    process.argv[4] ||
    'https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive.file').split(',');
oauthUtil_1.oauth(tokenPath, clientSecretPath, 'web', scope);
//# sourceMappingURL=oauth.js.map