import {clear} from './index'

const dbconfigFile = process.env.npm_package_config_dbconfig || process.argv[2];

clear(require('../'+dbconfigFile));
