import {FieldDef} from 'pg';

export class Table{
    public name: string;
    public fields: FieldDef[];
    public values: any[][];
    public maxSequenceValue: number;

    constructor(name: string, fields: FieldDef[], values: string[][], maxSequenceValue: number){
        this.name = name;
        this.fields = fields;
        this.values = values;
        this.maxSequenceValue = maxSequenceValue;
    }
}
