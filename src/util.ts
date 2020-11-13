import { Query } from "./ast";
import { Database, Row } from "./sqlEngine";

export function conditional(condition: boolean, onTrue: (ast: Query, db: Database, rows: Row[]) => Row[]): (ast: Query, db: Database, input: Row[]) => Row[] {
    if (condition) {
        return onTrue;
    }
    return (_ast: Query, _db: Database, rows: Row[]) => rows;
}
export function pipe(...functions: Array<(ast: Query, db: Database, input: Row[]) => Row[]>): (ast: Query, db: Database) => Row[] {
    return (ast: Query, db: Database) => {
        return functions.reduce((currentValue: Row[], currentFunction: (ast: Query, db: Database, input: Row[]) => Row[]) => {
            return currentFunction(ast, db, currentValue);
        }, []);
    };
}

export function isDefined(value: object | undefined | null): boolean{
    return value !== undefined && value !== null
}