import t from 'tcomb'
import TCombGraphQLSchema, { fn } from '..'
import { rule } from 'graphql-shield'

export const isAuthenticated = rule()((parent, args, ctx, info) => {
  return !!ctx.user
})

const schema = new TCombGraphQLSchema()

const randomInt = fn({}, t.struct({ int: t.Integer }, 'RandomInt'))

schema.addQueries({ randomInt })

schema.addResolvers({
  Query: {
    randomInt() {
      return { int: Math.floor(Math.random() * 100) }
    }
  }
})

schema.addPermissions({
  Query: {
    randomInt: isAuthenticated
  }
})

console.log(schema.print())

const query = `{
  randomInt {
    int
  }
}
`

const exec = schema.compile()

const log = results => console.log(JSON.stringify(results))

// Permission denied
exec(query).then(log)

// {"data":{"randomInt":...}}
exec(query, null, {user: 1}).then(log)
