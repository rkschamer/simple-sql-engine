
export type ScalarValue = string | number

export class Field {
    constructor(public readonly table: string, public readonly column: string) {    }
}
export class SelectClause { 
    constructor(public readonly table: string, public readonly fields: Field[]){

    }
}
export class JoinClause {
    constructor(public readonly table: string, public readonly fields: Field[]){

    }
 }
export class WhereClause { 
    constructor(public readonly left: Field | ScalarValue, public readonly right: Field | ScalarValue, public operator: string){

    }
}
export class Query  {
    constructor(public readonly select: SelectClause, public readonly joins: JoinClause[] | null, public readonly where: WhereClause | null){

}

}