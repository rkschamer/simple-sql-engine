import { parse } from "./parser";
import { Query, Field, ScalarValue } from "./ast";


interface Database {
    [key: string]: Array<Row>
}

interface Row {
    [key: string]: ScalarValue
}

function getFqnColumn(column: Field) {
    return `${column.table}.${column.column}`
}



function getValue(value: Field | ScalarValue, row: Row): ScalarValue {
    if (value instanceof Field) {
        return row[getFqnColumn(value)] as ScalarValue;
    }
    return value
}

function compareRow(left: Field | ScalarValue, right: Field | ScalarValue, operator: string, row: Row): boolean {
    const leftValue = getValue(left, row)
    const rightValue = getValue(right, row)

    switch (operator) {
        case "<>": return leftValue !== rightValue
        case "<=": return leftValue <= rightValue
        case ">=": return leftValue >= rightValue
        case "<": return leftValue < rightValue
        case ">": return leftValue > rightValue
        case "=": return leftValue === rightValue
        default:
            throw new Error(`Unknown operator: ${operator}`)
    }
}

// class Result {
//     readonly rows: Row[] 

//     constructor(rows: Row[]){
//         this.rows = rows
//     }

//     /**
//      * process
//      */
//     public process(p: (r: Row[]) => Row[]) : Result {
//         return new Result(p(this.rows))
//     }
// }

export class SQLEngine {

    private db: Database

    constructor(db: Database) {
        this.db = this.initialize(db)
    }

    private initialize(db: Database): Database {
        // change to fully-qualified column names to make further processing easier
        const newDb: Database = {}
        for (const [tableName, rows] of Object.entries(db)) {
            newDb[tableName] = rows.map(r => {
                const newRow: Row = {}
                for (const [key, value] of Object.entries(r)) {
                    newRow[`${tableName}.${key}`] = value
                }
                return newRow
            })
        }
        return newDb
    }

    /**
     * execute
     */
    public execute(query: string): any {
        const ast: Query | null = parse(query)
        if (ast === null) {
            throw new Error(`Cannot parse: '${query}'`)
        }

        const table: Row[] = this.getTable(ast.select.table)

        let result = table

        if (ast.joins) {
            for (const joinClause of ast.joins) {
                const joinTable: Array<Row> = this.getTable(joinClause.table)

                const joinedRows = []
                for (const resultRow of result) {
                    for (const joinRow of joinTable) {
                        const joinedRow = { ...resultRow, ...joinRow }
                        if (compareRow(joinClause.fields[0], joinClause.fields[1], "=", joinedRow)) {
                            joinedRows.push(joinedRow)
                        }
                    }
                }
                result = joinedRows
            }
        }

        if (ast.where) {
            const whereClause = ast.where
            result = result.filter(row =>
                compareRow(whereClause.left, whereClause.right, whereClause.operator, row)
            )
        }

        const selectedColumnsFqn = ast.select.fields.map(getFqnColumn)
        result = result.map(r => {
            const resultRow: Row = {}
            for (const selectedColumn of selectedColumnsFqn) {
                resultRow[selectedColumn] = r[selectedColumn]
            }
            return resultRow
        })

        return result;
    }

    private getTable(name: string): Row[]{
        const table = this.db[name]
        if (table === undefined || table === null) {
            throw new Error(`Cannot find table in database: '${name}'`)
        }
        return table;
    }
}