import {Client, FieldDef} from 'pg';
import { Table } from './Table';
import * as _ from 'lodash';

const createOrReplaceFunction = (statement: string) => {
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

interface StatementArgs {
    statement: string;
    args: string[];
}

export const dumpDBToCSV = (dir: string): StatementArgs[] => {
    const defineStatement = `statement := 'COPY "' || tables.schema_table || '" TO ''' || path || '/' || tables.schema_table || '.csv' ||''' DELIMITER E''\\t'' CSV HEADER';`;
    return [
        {
            statement: createOrReplaceFunction(defineStatement),
            args: [],
        },
        { statement: 'SELECT executeOnTables($1);', args: [dir] },
    ];
};

export const restoreDBFromCSV = (
    dir: string,
    tableNames: string[],
): StatementArgs[] => {
    return tableNames
        .map((tableName: string) => {
            return {
                statement: `COPY public.${tableName} FROM '${dir}/${tableName}.csv' DELIMITER E'\t' CSV HEADER;`,
                args: [],
            };
        })
        .concat(
            tableNames.map((tableName: string) => {
                return {
                    statement: `SELECT setval('public.${tableName}_id_seq',(SELECT max(id) FROM 'public.${tableName}'))`,
                    args: [],
                };
            }),
        );
};

export const clearDB = async (dbconfig: any) => {
    const client = new Client(dbconfig);
    await client.connect();
    const results = await Promise.all(
        dbconfig.tables.map(async (tableName: string) => {
            const res = await client.query({
                text: `TRUNCATE public.${tableName} CASCADE;`,
                values: [],
            });
        }),
    );
    await client.end();
    return results;
};

export const readTablesFromDB = async (dbconfig: any): Promise<Table[]> => {
    const maxSerialNum: {[key: string]: number} = {};
    const client = new Client(dbconfig);
    await client.connect();
    const results = await Promise.all<Table>(
        dbconfig.tables.map(async (tableName: string) => {
            const res = await client.query({
                text: `SELECT * from public.${tableName};`,
                values: [],
                rowMode: 'array',
            });
            if(0 <= res.fields.findIndex(field=>field.name == 'id')){
                const maxSerialNum = (await client.query({
                    text: `SELECT MAX(id) as max from public.${tableName};`,
                    values: [],
                })).rows[0].max;
                return new Table(tableName, res.fields, res.rows||[], maxSerialNum);
            }
            return new Table(tableName, res.fields, res.rows||[], -1);
        }),
    );
    await client.end();
    return results;
};

export const resetSequence = async (client: Client, table: Table) => {
    const text = `SELECT setval('public.${table.name}_id_seq', (SELECT max(id) FROM public.${table.name}));`;
    return client
        .query(text)
        .catch(err => console.log(err + ':\t' + text + '\n'));
};

export const deleteRowsTablesOnDB = async (dbconfig: any, table: Table, mustBeRemovedUUIDs: any) => {
    const client = new Client(dbconfig);
    await client.connect();
    if(0 < Object.keys(mustBeRemovedUUIDs).length){
        const res = await client.query({
            text: `DELETE FROM public.${table.name} WHERE uuid IN (${Object.keys(mustBeRemovedUUIDs).map(key=>`'${key}'`).join(',')});`,
            values: [],
        });
    };
    await client.end();
}

export const insertOrUpdateTablesOnDB = async (dbconfig: any, tables: Table[]) => {
    const client = new Client(dbconfig);
    await client.connect();
    const results = await Promise.all(
        tables.map(async (table: Table) => {
            await resetSequence(client, table);
            await Promise.all(
                table.values.map(async row => {
                    let uuid = undefined;
                    const colNames: string[] = [];
                    const values = row.filter(
                        (value: string, index: number) => {
                            const dataTypeID = table.fields[index].dataTypeID;
                            if(table.fields[index].name == 'uuid'){
                                uuid = value;
                            }
                            // console.log(dataTypeID, table.fields[index].name);
                            if (
                                !(
                                    value == '' &&
                                    (dataTypeID == 20 ||
                                        dataTypeID == 23 ||
                                        dataTypeID == 2950 ||
                                        dataTypeID == 1114)
                                )
                            ) {
                                colNames.push(table.fields[index].name);
                                return true;
                            } else {
                                return false;
                            }
                        },
                    );

                    const colNamesStr = colNames
                        .map(colName => '"' + colName + '"')
                        .join(',');

                    const placeHolders = _.times(colNames.length)
                        .map(n => '$' + (n + 1))
                        .join(',');

                    const updaters = colNames
                        .map((colName, index) => `"${colName}" = (\$${colNames.length+index+1})`)
                        .join(', ');

                    const text = `INSERT INTO public.${
                        table.name
                    } (${colNamesStr}) VALUES (${placeHolders}) ON CONFLICT (uuid) DO UPDATE SET ${updaters};`;

                    await client
                        .query(text, values.concat(values)) // .concat([uuid]
                        .catch(err =>
                            console.log(
                                err +
                                    ':\t' +
                                    text +
                                    '\n' +
                                    JSON.stringify(values),
                            ),
                        );
                }),
            );

            return await resetSequence(client, table);
        }),
    );
    await client.end();
    return results;
};
