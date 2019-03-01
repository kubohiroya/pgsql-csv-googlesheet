"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const dbconfigFile = process.env.npm_package_config_dbconfig || process.argv[2];
index_1.clear(require('../' + dbconfigFile));
//# sourceMappingURL=clear.js.map