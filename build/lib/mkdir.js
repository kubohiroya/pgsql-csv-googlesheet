"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
exports.mkdir = (dir) => {
    if (fs.statSync(dir).isDirectory()) {
        fs.readdirSync(dir).forEach(file => {
            fs.unlinkSync(dir + '/' + file);
        });
    }
    else {
        fs.unlinkSync(dir);
        fs.mkdirSync(dir);
    }
};
//# sourceMappingURL=mkdir.js.map