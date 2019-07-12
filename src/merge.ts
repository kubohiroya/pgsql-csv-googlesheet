import { SCOPE_SPREADSHEET } from './index';
import { mergeSheetAndDB } from './lib/MergeUtil';

const tokenPath = process.env.npm_package_config_tokenPath || process.argv[2];
const clientSecretPath =
  process.env.npm_package_config_clientSecretPath || process.argv[3];
const spreadsheetId =
  process.env.npm_package_config_spreadsheetId || process.argv[4];
const dbconfig = require(process.env.npm_package_config_dbconfig ||
  process.argv[5]);

try {
  mergeSheetAndDB(
    tokenPath,
    clientSecretPath,
    'installed',
    SCOPE_SPREADSHEET,
    spreadsheetId,
    dbconfig,
  );
} catch (err) {
  console.error(err);
}
