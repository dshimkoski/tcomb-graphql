import t from 'tcomb'
import TCombGraphQLSchema, { arg, fn, type, input } from '..'

const schema = new TCombGraphQLSchema()

const Message = type('Message', null, { text: t.String })
const message = fn({ id: t.ID }, t.maybe(Message), null, 'Fetch a message by ID')
const SendMessageInput = input('SendMessageInput', 'sendMessage input', { text: t.String })
const SendMessageOutput = type('SendMessageOutput', 'sendMessage response', { sent: t.Boolean })
const messageSent = fn({ toId: arg(t.maybe(t.ID), null, 'optionally limit to particular User ID') }, Message)
const sendMessage = fn({ input: SendMessageInput }, SendMessageOutput, messageSent, 'Send a message')

schema.addMutations({ sendMessage })
schema.addQueries({ message })

const Beep = type('Beep', 'A beep noise', { beepiness: t.Integer })
const Boop = type('Boop', 'A boop noise', { boopiness: t.Integer })
const BotNoise = t.union([Beep, Boop], 'BotNoise')
BotNoise.dispatch = x => x.boopiness ? Boop : Beep
const botNoises = fn({}, t.list(t.maybe(BotNoise)), null, 'Fetch a list of bot noises')

schema.addQueries({ botNoises })
schema.addResolvers({
  Query: {
    botNoises: () => ([{ boopiness: 20 }])
  }
})

console.log(schema.print())

const query = `{
  message(id: 1) {
    text
  }
  botNoises {
    ... on Beep { beepiness }
    ... on Boop { boopiness }
  }
}
`

const exec = schema.compile()
exec(query).then(results => console.log(JSON.stringify(results)))
