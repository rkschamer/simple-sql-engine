export class Result<TMatch> {
    constructor(public readonly match: TMatch, public readonly nextPosition: number = 0) { }
}

export class ParserError {
    constructor(public readonly stringToParse: string, public readonly pos: number, public readonly expectedToken?: string) { }
}

export class Pattern<TMatch> {
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


export function txt(text: string): Pattern<string> {
    return new Pattern(`txt: ${text}`, (str: string, pos: number): Result<string> | ParserError => {
        if (str.substring(pos, pos + text.length) == text) {
            return new Result(text, pos + text.length)
        }
        return new ParserError(str, pos, text)
    })
}


export function regex(regex: RegExp): Pattern<string> {
    return new Pattern(`regex: ${regex}`, (str: string, pos: number): Result<string> | ParserError => {
        const result = regex.exec(str.slice(pos));
        if (result && result.index === 0) {
            return new Result(result[0], pos + result[0].length);
        }
        return new ParserError(str, pos, regex.toString());
    });
};

export function optional<T>(optionalPattern: Pattern<T>): Pattern<T | null> {
    return new Pattern(`optional: ${optionalPattern.name}`, (str: string, pos: number): Result<T | null> | ParserError => {
        const optionalResult = optionalPattern.exec(str, pos)
        if (optionalResult instanceof ParserError) {
            return new Result(null, pos)
        }
        return optionalResult
    })
}

export function any(...patterns: Pattern<any>[]): Pattern<Pattern<any>> {
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

export function seq(...patterns: Pattern<any>[]): Pattern<any[]> {
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
export function rep(pattern: Pattern<any>, separator: Pattern<any>): Pattern<any> {
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