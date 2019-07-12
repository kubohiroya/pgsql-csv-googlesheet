"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dbconfigFile = process.env.npm_package_config_dbconfig || process.argv[2];
const srcdir = process.env.npm_package_config_dumpdir || process.argv[3]; // '/tmp/dump';
const index_1 = require("./index");
index_1.restore(require('../' + dbconfigFile), srcdir);
//# sourceMappingURL=restore.js.map