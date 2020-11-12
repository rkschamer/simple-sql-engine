import { parse } from "./parser";
import { Query, Field, ScalarValue, SelectClause } from "./ast";
import { isDefined, pipe, conditional  } from "./util";

export interface Database {
    [key: string]: Array<Row>
}

export interface Row {
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

function padColumnNames(rawDb: Database): Database {
    const newDb: Database = {}
    for (const [tableName, rows] of Object.entries(rawDb)) {
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

function getTable(db: Database, tableName: string): Row[] {
    const table = db[tableName]
    if (!table) {
        throw new Error(`Cannot find table with name ${tableName}`);
    }
    return table
}


function doSelect(ast: Query, db: Database, rows: Row[]): Row[] {
    return getTable(db, ast.select.table)
}

function doProject(ast: Query, _db: Database, rows: Row[]): Row[] {
    const selectedColumnsFqn = ast.select.fields.map(getFqnColumn)
    return rows.map(r => Object.fromEntries(Object.entries(r).filter(([key, _value]) => selectedColumnsFqn.includes(key))))
}

function doWhere(ast: Query, _db: Database, rows: Row[]): Row[] {
    const whereClause = ast.where
    if (!whereClause) {
        throw new Error("Cannot execute doWhere without a where-clause")
    }
    return rows.filter(r => compareRow(whereClause.left, whereClause.right, whereClause.operator, r))
}

function doJoin(ast: Query, db: Database, rows: Row[]): Row[] {
    if (!ast.joins) {
        throw new Error("Cannot execute doJpin without a join-clause(s)")
    }

    let result = rows
    for (const joinClause of ast.joins) {
        const joinTable: Array<Row> = getTable(db, joinClause.table)

        const joinedRows = []
        for (const resultRow of result) {
            for (const joinRow of joinTable) {
                const joinedRow = { ...resultRow, ...joinRow }
                if (compareRow(joinClause.fields[0], joinClause.fields[1], "=", joinedRow)) {
                    joinedRows.push(joinedRow)
                }
            }
            result = joinedRows
        }
        
    }
    return result
}

export class SQLEngine {

    constructor(private readonly rawDb: Database) {
    }

    public execute(query: string): Row[] {
        const ast: Query | null = parse(query)
        if (ast === null) {
            throw new Error(`Cannot parse: '${query}'`)
        }

        const db = padColumnNames(this.rawDb)

        return pipe(
            doSelect,
            conditional(isDefined(ast.joins), doJoin),
            conditional(isDefined(ast.where), doWhere),
            doProject
        )(ast,db)
    }
}