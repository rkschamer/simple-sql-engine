import { parse } from "./parser"
import { Query, SelectClause, JoinClause, WhereClause, Field } from "./ast";

test("code wars example", () => {
    const query = `
        SELECT movies.title, actors.name
        FROM movies
        JOIN actors_in_movies ON actors_in_movies.movieID = movies.ID
        JOIN actors ON actors_in_movies.actorID = actors.ID
        WHERE movies.cert <= 15
    `

    const expectedAst = new Query(
        new SelectClause("movies", [new Field("movies", "title"), new Field("actors", "name")]),
        new Array<JoinClause>(new JoinClause("actors_in_movies", [new Field("actors_in_movies", "movieID"), new Field("movies", "ID")]), new JoinClause("actors", [new Field("actors_in_movies", "actorID"), new Field("actors", "ID")])),
        new WhereClause(new Field("movies", "cert"), 15, "<=")
    )
    const ast = parse(query)
    expect(ast).toEqual(expectedAst)
})