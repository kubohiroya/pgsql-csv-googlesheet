"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const googleapis_1 = require("googleapis");
const readline_1 = tslib_1.__importDefault(require("readline"));
const fs = tslib_1.__importStar(require("fs-extra"));
exports.oauth = (tokenPath, clientSecretPath, scope) => {
    // Load client secrets from a local file.
    return new Promise(function (resolve, reject) {
        fs.readFile(clientSecretPath, (err, content) => {
            if (err) {
                return reject('Error loading client secret file:' + err);
            }
            // Authorize a client with credentials, then call the Google Sheets API.
            authorize(tokenPath, JSON.parse(content.toString()), scope).then(auth => {
                resolve(auth);
            });
        });
    });
};
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(tokenPath, credentials, scope) {
    return new Promise(function (resolve) {
        const { client_secret, client_id, redirect_uris, } = credentials.installed;
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        // Check if we have previously stored a token.
        fs.readFile(tokenPath, (err, token) => {
            if (err) {
                getNewToken(oAuth2Client, tokenPath, scope).then(oauth => {
                    return resolve(oauth);
                });
            }
            else {
                oAuth2Client.setCredentials(JSON.parse(token.toString()));
                return resolve(oAuth2Client);
            }
        });
    });
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, tokenPath, scope) {
    return new Promise(function (resolve, reject) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope,
        });
        console.log('Authorize this app by visiting this url:', authUrl);
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', code => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    return reject('Error while trying to retrieve access token');
                }
                oAuth2Client.setCredentials(token);
                // Store the token to disk for later program executions
                fs.writeFile(tokenPath, JSON.stringify(token), err => {
                    if (err) {
                        return reject(err);
                    }
                    console.log('Token stored to', tokenPath);
                });
                return resolve(oAuth2Client);
            });
        });
    });
}
//# sourceMappingURL=OAuthUtil.js.map