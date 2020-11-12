import {  Result, ParserError, regex, any, optional, rep, seq, txt } from "./combinators";
import { Field, WhereClause, SelectClause, JoinClause, Query } from "./ast";

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

export function parse(rawString: string) : Query  {
    const noLineBreaks = rawString.replace(/\r?\n|\r/g, "")
    const result = queryExpression.exec(noLineBreaks, 0)

    if(result instanceof ParserError) {
        throw new Error(`Error while parsing at position ${result.pos}: expected token ${result.expectedToken}, acutal token ${result.stringToParse}`)
        
    } 

    return result.match
}