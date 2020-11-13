
type ScalarValue = string | number

class Field {
    constructor(public readonly table: string, public readonly column: string) {    }
}
class SelectClause { 
    constructor(public readonly table: string, public readonly fields: Field[]){

    }
}
class JoinClause {
    constructor(public readonly table: string, public readonly fields: Field[]){

    }
 }
class WhereClause { 
    constructor(public readonly left: Field | ScalarValue, public readonly right: Field | ScalarValue, public operator: string){

    }
}
class Query  {
    constructor(public readonly select: SelectClause, public readonly joins: JoinClause[] | null, public readonly where: WhereClause | null){}
}

class Result<TMatch> {
    constructor(public readonly match: TMatch, public readonly nextPosition: number = 0) { }
}

class ParserError {
    constructor(public readonly stringToParse: string, public readonly pos: number, public readonly expectedToken?: string) { }
}

class Pattern<TMatch> {
    constructor(public readonly name: string, public readonly exec: (str: string, currentPosition: number) => Result<TMatch> | ParserError) { }

    public then<R>(process: (result: Result<TMatch>) => R): Pattern<R> {
        return new Pattern(`then ${this.name}`, (str: string, pos: number): Result<R> | ParserError => {
            const result = this.exec(str, pos)
            if (result instanceof ParserError) {
                return result
            }
            return new Result(process(result), result.nextPosition)
        })
    }
}


function txt(text: string): Pattern<string> {
    return new Pattern(`txt: ${text}`, (str: string, pos: number): Result<string> | ParserError => {
        if (str.substring(pos, pos + text.length) == text) {
            return new Result(text, pos + text.length)
        }
        return new ParserError(str, pos, text)
    })
}


function regex(regex: RegExp): Pattern<string> {
    return new Pattern(`regex: ${regex}`, (str: string, pos: number): Result<string> | ParserError => {
        const result = regex.exec(str.slice(pos));
        if (result && result.index === 0) {
            return new Result(result[0], pos + result[0].length);
        }
        return new ParserError(str, pos, regex.toString());
    });
};

function optional<T>(optionalPattern: Pattern<T>): Pattern<T | null> {
    return new Pattern(`optional: ${optionalPattern.name}`, (str: string, pos: number): Result<T | null> | ParserError => {
        const optionalResult = optionalPattern.exec(str, pos)
        if (optionalResult instanceof ParserError) {
            return new Result(null, pos)
        }
        return optionalResult
    })
}

function any(...patterns: Pattern<any>[]): Pattern<Pattern<any>> {
    const patternName = `any: ${patterns.map(p => p.name).join(", ")}`
    return new Pattern(patternName, (str: string, pos: number): Result<Pattern<any>> | ParserError => {
        for (const pattern of patterns) {
            const result = pattern.exec(str, pos)
            if (result instanceof Result) {
                return result
            }
        }
        return new ParserError(str, pos)
    })
}

function seq(...patterns: Pattern<any>[]): Pattern<any[]> {
    const patternName = `seq: ${patterns.map(p => p.name).join(", ")}`
    return new Pattern(patternName, (str: string, pos: number): Result<any[]> | ParserError => {
        const results: Array<Result<Pattern<any>[]>> = []
        for (const pattern of patterns) {
            // getting the next position to parse for the current parser (pattern) or pos for the first 
            // iteration
            const currentPos = results.length > 0 ? results[results.length - 1].nextPosition : pos
            const result = pattern.exec(str, currentPos)

            if (result instanceof ParserError) {
                return result
            }

            results.push(result)
        }
        const matches = results.map(r => r.match)
        return new Result(matches, results[results.length - 1].nextPosition)
    })
}

/**
 * Pattern to match repetitive sequences like `abc, dfe, gfh`, without having the issue of left recursion.
 * In the first round the pattern is matched and 
 *
 */
function rep(pattern: Pattern<any>, separator: Pattern<any>): Pattern<any> {
    // construct a pattern that matches the separator and the pattern for all rounds but the first; this pattern
    // is used to match `, <abc>`, whereas ',' is the separator and '<abc>' is the pattern
    const separated = seq(separator, pattern).then((r: Result<any[]>) => {
        return r.match[1]
    })

    const patternName = `seq: ${pattern.name}, separator ${separator.name}`
    return new Pattern(patternName, (str: string, pos: number): Result<any[]> | ParserError => {
        const results: Array<any> = []
        // first round matches the pattern; all subsequent rounds require separator + pattern to match
        let intermediateResult = pattern.exec(str, pos)

        while (!(intermediateResult instanceof ParserError)) {
            results.push(intermediateResult)
            intermediateResult = separated.exec(str, results[results.length - 1].nextPosition)
        }

        if (results.length < 1) {
            return new ParserError(str, pos)
        }
        const matches = results.map((r) => r.match)
        return new Result(matches, results[results.length - 1].nextPosition)
    })
}

// whitespace
const ws = regex(/\s+/)
// optional whitespace
const ows = regex(/\s*/)
const dot = regex(/\./)
const comma = regex(/\s*,\s*/)
const str = regex(/(["'])(.*)[^\\]\1/).then((r: Result<string>) => {
    
    const match = r.match
    return match
    // remove starting single or double quotes
    .substring(1, match.length - 1)
    // replace escaped single quotes in string 
    // (in task description: escaping internal single quotes by doubling them (for example, 'a ''string'' containing quotes'))
    .replace("''", "'")
});
const num = regex(/[\d\.\-]+/).then((r: Result<string>) => {
    return parseFloat(r.match);
});
const bool = regex(/true|false/i).then(function (res) {
    return Boolean(res);
});
const nul = regex(/null/i).then(function () {
    return null;
});
// table or column name
const name = regex(/[a-z_]+[a-z0-9_]+/i)
const column = name
const table = name
const select = regex(/select/i);
const from = regex(/from/i);
const join = regex(/join/i);
const on = regex(/on/i);
const where = regex(/where/i);


const qualifiedField = seq(name, dot, name).then((r:Result<string[]>) => new Field(r.match[0], r.match[2]))
const fieldEquality = seq(qualifiedField, ows, txt("="), ows, qualifiedField).then((r:Result<string[]>) => [r.match[0], r.match[4]])
const listOfFields = rep(qualifiedField, comma)
const comparison = any(
    txt('<>'),
    txt('<='),
    txt('>='),
    txt('<'),
    txt('>'),
    txt('=')
  )
const val =  any(str, num, bool, nul, qualifiedField)

const selectExpression = seq(select, ws, listOfFields, ws, from, ws, table).then((r: Result<any[]>) => {
    return new SelectClause(r.match[6] as string, r.match[2] as Field[])
})
const joinExpression = seq(join, ws, table, ws, on, ws, fieldEquality).then((r: Result<any[]>) => {
    return new JoinClause(r.match[2]as string, r.match[6] as Field[])
})
const whereExpression =  seq(
    where, ws, 
    // this is the actual comparison a = b
    val, ows, comparison, ows, val,
    ows
  ).then((r: Result<any[]>) => {
      return new WhereClause(r.match[2] as string, r.match[6] as string, r.match[4] as string)
  })

const queryExpression = seq(
    ows, selectExpression,
    optional(seq(ws, rep(joinExpression, ows))),
    optional(seq(ws, optional(whereExpression))), ows
).then((r: Result<any[]>) => {
    const select = r.match[1] as SelectClause
    let joins = null
    if(r.match[2] instanceof Array){
        joins = r.match[2][1] as JoinClause[]
    }
    let where = null
    if(r.match[3] instanceof Array){
        where = r.match[3][1] as WhereClause
    }
    
    return new Query(select, joins, where)
})

function parse(rawString: string) : Query  {
    const noLineBreaks = rawString.replace(/\r?\n|\r/g, "")
    const result = queryExpression.exec(noLineBreaks, 0)

    if(result instanceof ParserError) {
        throw new Error(`Error while parsing at position ${result.pos}: expected token ${result.expectedToken}, acutal token ${result.stringToParse}`)
        
    } 

    return result.match
}

function conditional(condition: boolean, onTrue: (ast: Query, db: Database, rows: Row[]) => Row[]): (ast: Query, db: Database, input: Row[]) => Row[] {
    if (condition) {
        return onTrue;
    }
    return (_ast: Query, _db: Database, rows: Row[]) => rows;
}
function pipe(...functions: Array<(ast: Query, db: Database, input: Row[]) => Row[]>): (ast: Query, db: Database) => Row[] {
    return (ast: Query, db: Database) => {
        return functions.reduce((currentValue: Row[], currentFunction: (ast: Query, db: Database, input: Row[]) => Row[]) => {
            return currentFunction(ast, db, currentValue);
        }, []);
    };
}

function isDefined(value: object | undefined | null): boolean{
    return value !== undefined && value !== null
}

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

    return ast.joins.reduce(
        (previousRows, joinClause) => {
            const joinTable: Array<Row> = getTable(db, joinClause.table)
            return previousRows.flatMap(previousRow => {
                const joinedRows = []
                for (const joinRow of joinTable) {
                    const potentialRow = { ...previousRow, ...joinRow }
                    if (compareRow(joinClause.fields[0], joinClause.fields[1], "=", potentialRow)) {
                        joinedRows.push(potentialRow)
                    }
                }
                return joinedRows
            })
        },
        rows
    )
}

class SQLEngine {

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
        )(ast, db)
    }
}