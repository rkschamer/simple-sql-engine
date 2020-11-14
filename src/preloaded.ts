import { expect } from "chai"

export type ScalarValue = string | number

export interface Row {
    [key: string]: ScalarValue
}

export type Table = Row[]

export interface Database {
    [key: string]: Table
}

export function assertSimilarRows(actual: Row[], expected: Row[]) {
    expect(actual).to.have.deep.members(expected)
}