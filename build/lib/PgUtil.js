"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const pg_1 = require("pg");
const Table_1 = require("./Table");
const _ = tslib_1.__importStar(require("lodash"));
const createOrReplaceFunction = (statement) => {
    return `
CREATE OR REPLACE FUNCTION executeOnTables(path TEXT) RETURNS void AS $$
declare
   tables RECORD;
   statement TEXT;
begin
FOR tables IN
   SELECT (table_name) AS schema_table
   FROM information_schema.tables t INNER JOIN information_schema.schemata s
   ON s.schema_name = t.table_schema
   WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'configuration')
   AND t.table_type NOT IN ('VIEW')
   AND t.table_schema <> 'query-result-cache'
   AND t.table_schema <> 'query-result-cache_id_seq'
   ORDER BY t.table_type DESC, schema_table
LOOP
   ${statement}
   EXECUTE statement;
END LOOP;
return;
end;
$$ LANGUAGE plpgsql;
`;
};
exports.dumpDBToCSV = (dir) => {
    const defineStatement = `statement := 'COPY "' || tables.schema_table || '" TO ''' || path || '/' || tables.schema_table || '.csv' ||''' DELIMITER E''\\t'' CSV HEADER';`;
    return [
        {
            statement: createOrReplaceFunction(defineStatement),
            args: [],
        },
        { statement: 'SELECT executeOnTables($1);', args: [dir] },
    ];
};
exports.restoreDBFromCSV = (dir, tableNames) => {
    return tableNames
        .map((tableName) => {
        return {
            statement: `COPY public.${tableName} FROM '${dir}/${tableName}.csv' DELIMITER E'\t' CSV HEADER;`,
            args: [],
        };
    })
        .concat(tableNames.map((tableName) => {
        return {
            statement: `SELECT setval('public.${tableName}_id_seq',(SELECT max(id) FROM 'public.${tableName}'))`,
            args: [],
        };
    }));
};
exports.clearDB = async (dbconfig) => {
    const client = new pg_1.Client(dbconfig);
    await client.connect();
    const results = await Promise.all(dbconfig.tables.map(async (tableName) => {
        const res = await client.query({
            text: `TRUNCATE public.${tableName} CASCADE;`,
            values: [],
        });
    }));
    await client.end();
    return results;
};
exports.readTablesFromDB = async (dbconfig) => {
    const maxSerialNum = {};
    const client = new pg_1.Client(dbconfig);
    await client.connect();
    const results = await Promise.all(dbconfig.tables.map(async (tableName) => {
        const res = await client.query({
            text: `SELECT * from public.${tableName};`,
            values: [],
            rowMode: 'array',
        });
        if (0 <= res.fields.findIndex(field => field.name == 'id')) {
            const maxSerialNum = (await client.query({
                text: `SELECT MAX(id) as max from public.${tableName};`,
                values: [],
            })).rows[0].max;
            return new Table_1.Table(tableName, res.fields, res.rows || [], maxSerialNum);
        }
        return new Table_1.Table(tableName, res.fields, res.rows || [], -1);
    }));
    await client.end();
    return results;
};
exports.resetSequence = async (client, table) => {
    const text = `SELECT setval('public.${table.name}_id_seq', (SELECT max(id) FROM public.${table.name}));`;
    return client
        .query(text)
        .catch(err => console.log(err + ':\t' + text + '\n'));
};
exports.deleteRowsTablesOnDB = async (dbconfig, table, mustBeRemovedUUIDs) => {
    const client = new pg_1.Client(dbconfig);
    await client.connect();
    if (0 < Object.keys(mustBeRemovedUUIDs).length) {
        const res = await client.query({
            text: `DELETE FROM public.${table.name} WHERE uuid IN (${Object.keys(mustBeRemovedUUIDs).map(key => `'${key}'`).join(',')});`,
            values: [],
        });
    }
    ;
    await client.end();
};
exports.insertOrUpdateTablesOnDB = async (dbconfig, tables) => {
    const client = new pg_1.Client(dbconfig);
    await client.connect();
    const results = await Promise.all(tables.map(async (table) => {
        await exports.resetSequence(client, table);
        await Promise.all(table.values.map(async (row) => {
            let uuid = undefined;
            const colNames = [];
            const values = row.filter((value, index) => {
                const dataTypeID = table.fields[index].dataTypeID;
                if (table.fields[index].name == 'uuid') {
                    uuid = value;
                }
                // console.log(dataTypeID, table.fields[index].name);
                if (!(value == '' &&
                    (dataTypeID == 20 ||
                        dataTypeID == 23 ||
                        dataTypeID == 2950 ||
                        dataTypeID == 1114))) {
                    colNames.push(table.fields[index].name);
                    return true;
                }
                else {
                    return false;
                }
            });
            const colNamesStr = colNames
                .map(colName => '"' + colName + '"')
                .join(',');
            const placeHolders = _.times(colNames.length)
                .map(n => '$' + (n + 1))
                .join(',');
            const updaters = colNames
                .map((colName, index) => `"${colName}" = (\$${colNames.length + index + 1})`)
                .join(', ');
            const text = `INSERT INTO public.${table.name} (${colNamesStr}) VALUES (${placeHolders}) ON CONFLICT (uuid) DO UPDATE SET ${updaters};`;
            await client
                .query(text, values.concat(values)) // .concat([uuid]
                .catch(err => console.log(err +
                ':\t' +
                text +
                '\n' +
                JSON.stringify(values)));
        }));
        return await exports.resetSequence(client, table);
    }));
    await client.end();
    return results;
};
//# sourceMappingURL=PgUtil.js.map