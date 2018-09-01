const dbconfigFile = process.env.npm_package_config_dbconfig || process.argv[2];
const outdir = process.env.npm_package_config_dumpdir || process.argv[3]; // '/tmp/dump';

import {dump} from './index'
dump(require('../'+dbconfigFile), outdir);
