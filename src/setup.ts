import { Database, Row } from "./preloaded";

class SQLEngine {

    constructor(private readonly database: Database) {
    }

    public execute(query: string): Row[] {
        throw new Error("Not implemented yet!")
    }
}