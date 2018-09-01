const dbconfigFile = process.env.npm_package_config_dbconfig || process.argv[2];
const srcdir = process.env.npm_package_config_dumpdir || process.argv[3]; // '/tmp/dump';

import {restore} from './index'
restore(require('../'+dbconfigFile), srcdir);
