# tcomb-graphql

Convert tcomb types to secure, executable GraphQL schemas *(WIP)*

## Getting Started

An npm package will be created once the code is more stable, but for now you'll have to clone this repo and `npm install`

## Basic Example [source](examples/basic.js)

`node -r esm examples/basic`

```graphql
"""A beep noise"""
type Beep {
  beepiness: Int!
}

"""A boop noise"""
type Boop {
  boopiness: Int!
}

union BotNoise = Beep | Boop

type Message {
  text: String!
}

type Mutation {
  """Send a message"""
  sendMessage(input: SendMessageInput!): SendMessageOutput!
}

type Query {
  """Fetch a message by ID"""
  message(id: ID!): Message

  """Fetch a list of bot noises"""
  botNoises: [BotNoise]!
}

"""sendMessage input"""
input SendMessageInput {
  text: String!
}

"""sendMessage response"""
type SendMessageOutput {
  sent: Boolean!
}

type Subscription {
  sendMessage(
    """optionally limit to particular User ID"""
    toId: ID
  ): Message!
}

{"data":{"message":null,"botNoises":[{"boopiness":20}]}}
```

## Secure Example [source](examples/secure.js)

`node -r esm examples/secure`

```graphql

type Query {
  randomInt: RandomInt!
}

type RandomInt {
  int: Int!
}

{"errors":[{"message":"Permission denied","locations":[{"line":2,"column":3}],"path":["randomInt"]}],"data":null}
{"data":{"randomInt":{"int":25}}}
```
