import _ from 'lodash';
import fs from 'fs';
import { Table } from './Table';

export const createCSV = (rows: string[][]) => {
    return (
        rows
            .map((row: string[]) => {
                const padding = _.fill(Array(rows[0].length - row.length), '');
                return row.concat(padding).join('\t');
            })
            .join('\n') + '\n'
    );
};

export const readCSV = (srcdir: string, csvFile: string) => {
    return fs
        .readFileSync(srcdir + '/' + csvFile, 'utf-8')
        .trim()
        .split('\n')
        .map((row: string) => {
            return row.split('\t');
        });
};

export const getCsvFileList = (srcdir: string): Promise<string[]> => {
    return new Promise((resolve: any, reject: any) => {
        fs.readdir(srcdir, (err: any, files: any) => {
            if (err) {
                return reject(err);
            }
            return resolve(
                files.filter((file: any) => {
                    return (
                        fs.statSync(srcdir + '/' + file).isFile() &&
                        /.*\.csv$/.test(file)
                    ); //絞り込み
                }),
            );
        });
    });
};

export const readTablesFromCSVFiles = (
    srcdir: string,
    csvFileList: string[],
) => {
    return Promise.all<Table>(
        csvFileList.map((csvFile: string) => {
            const tablename: string = csvFile.split('.csv')[0];
            return new Promise<Table>((resolve: any, reject: any) => {
                const csv = readCSV(srcdir, csvFile);
                const fields = csv[0];
                const values = csv.splice(1);
                return resolve(new Table(tablename, fields, values));
            });
        }),
    );
};

export const createCSVFiles = (tables: Table[], outdir: string) => {
    tables.forEach((table: Table) => {
        fs.writeFileSync(
            outdir + '/' + table.name + '.csv',
            createCSV(table.values),
        );
    });
};
