import {google} from 'googleapis';
import * as readline from 'readline';
import * as fs from 'fs-extra';

export const oauth = (tokenPath: string, clientSecretPath: string, scope: string[]) => {
    // Load client secrets from a local file.
    return new Promise(function(resolve, reject) {
        const credentials = require(clientSecretPath);
        authorize(tokenPath, credentials, scope).then(auth => {
            resolve(auth);
        });
    });
};

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(tokenPath: string, credentials: any, scope: string[]) {
    return new Promise(function(resolve) {
        const {
            client_secret,
            client_id,
            redirect_uris,
        } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0],
        );

        // Check if we have previously stored a token.
        fs.readFile(tokenPath, (err: any, token: Buffer) => {
            if (err) {
                getNewToken(oAuth2Client, tokenPath, scope).then(oauth => {
                    return resolve(oauth);
                });
            } else {
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
function getNewToken(oAuth2Client: any, tokenPath: string, scope: string[]) {
    return new Promise(function(resolve, reject) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope,
        });
        console.log('Authorize this app by visiting this url:', authUrl);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', code => {
            rl.close();
            oAuth2Client.getToken(code, (err: any, token: Buffer) => {
                if (err) {
                    return reject(
                        'Error while trying to retrieve access token'
                    );
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
