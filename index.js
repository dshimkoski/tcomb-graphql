/**
 * Convert tcomb types to secure, executable GraphQL schemas (WIP)
 *
 * @author Denny Shimkoski
 */

import t from 'tcomb'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
  graphql,
  printSchema
} from 'graphql'
import { GraphQLDate } from 'graphql-iso-date'
import { addResolveFunctionsToSchema } from 'graphql-tools'
import { applyMiddleware } from 'graphql-middleware'
import { shield } from 'graphql-shield'
import deepExtend from 'deep-extend'

/**
 * Extensible type map
 *
 * Maps tcomb types to GraphQL types
 *
 * Applications should register custom scalars here
 */
export const typeMap = {
  Boolean: GraphQLBoolean,
  Date: GraphQLDate,
  ID: GraphQLID,
  Integer: GraphQLInt,
  Number: GraphQLFloat,
  String: GraphQLString,
  enums,
  interface: inter,
  list,
  maybe,
  struct,
  union
}

/**
 * GraphQL ID type for tcomb
 *
 * @param {number|string} ID
 *
 * @return {Object} tcomb type
 */
t.ID = t.union([t.String, t.Integer], 'ID')

/**
 * Transform a tcomb type into the equivalent GraphQL type
 *
 * @param {Object} type - tcomb type
 * @param {boolean} optional
 *
 * @return {Object} GraphQL type
 */
export function transform (type, optional) {
  let x = typeMap[type.meta.name] || typeMap[type.meta.kind]
  x = typeof(x) === 'function' ? x(type) : x
  if (optional) {
    return x
  } else {
    return x.maybe ? x.type : new GraphQLNonNull(x)
  }
}

/**
 * Transform enum
 *
 * @param {Object} type - tcomb enum
 *
 * @return {Object} GraphQL type
 */
function enums(type) {
  return type.gql || (type.gql = new GraphQLEnumType({
    name: t.getTypeName(type),
    values: Object.entries(type.meta.map).reduce((values, [k, v]) => {
      values[k] = { value: v }
      return values
    }, {})
  }))
}

/**
 * Transform list
 *
 * @param {Object} type - tcomb list
 *
 * @return {Object} GraphQL type
 */
function list(type) {
  return new GraphQLList(transform(type.meta.type))
}

/**
 * Transform maybe
 *
 * Wraps type temporarily to notify transform function of maybe
 *
 * @param {Object} type - tcomb type
 *
 * @return {Object} wrapped GraphQL type
 */
function maybe(type) {
  return {maybe: true, type: transform(type.meta.type, true)}
}

/**
 * Transform interface
 *
 * Application must implement resolveType
 *
 * @param {Object} type - tcomb interface
 *
 * @return {Object} GraphQL interface
 */
function inter(type) {
  return object(type, GraphQLInterfaceType)
}

/**
 * Transform struct
 *
 * @param {Object} type - tcomb struct
 *
 * @return {Object} GraphQL type
 */
function struct(type) {
  return object(type, type.__input ? GraphQLInputObjectType : GraphQLObjectType)
}

/**
 * Transform union
 *
 * @param {Object} type - tcomb union
 *
 * @return {Object} GraphQL type
 */
function union(type) {
  return new GraphQLUnionType({
    name: t.getTypeName(type),
    description: type.__typeDesc || type.__desc,
    types: type.meta.types.map(t => transform(t, true)),
    resolveType: data => t.getTypeName(type.dispatch(data))
  })
}

/**
 * Transform tcomb type into given GraphQLType
 *
 * @param {Object} type - tcomb type
 *
 * @return {Object} GraphQL type
 */
function object(type, GraphQLType) {
  if (type.gql) {
    return type.gql
  }

  type.gql = new GraphQLType({
    name: t.getTypeName(type),
    description: type.__typeDesc || type.__desc,
    interfaces: type.interfaces && type.interfaces.map(i => transform(i, true)),
    fields: Object.entries(type.meta.props).reduce((fields, [prop, propType]) => {
      fields[prop] = {
        type: transform(propType),
        defaultValue: propType.__val,
        description: propType.__desc,
        args: propType.__args && Object.entries(propType.__args).reduce((args, [k, v]) => {
          const arg = { type: transform(v) }
          arg.defaultValue = v.__val
          arg.description = v.__desc
          args[k] = arg
          return args
        }, {})
      }
      return fields
    }, {})
  })

  // mangle: { reserved: ['GraphQLObjectType', 'GraphQLUnionType', 'GraphQLInterfaceType'] }
  // TODO: revisit https://github.com/acarl005/join-monster/issues/352
  type.gql._typeConfig = {}

  return type.gql
}

/**
 * Create proxy for tcomb type
 *
 * Proxies share the underlying type while retaining their own identity,
 * so they can be used to annotate a single type in different contexts
 *
 * @param {Object} type - tcomb type
 * @param {Object} props - additional properties
 *
 * @return {Object} proxied type
 */
function proxy (Type, props) {
  const keys = Object.keys(props)
  const p = new Proxy(Type, {
    get(obj, key) {
      if (keys.indexOf(key) > -1) {
        return this[key]
      }
      return obj[key]
    },
    set(obj, key, val) {
      if (keys.indexOf(key) > -1) {
        this[key] = val
        return true
      }
      obj[key] = val
      return true
    }
  })
  return Object.assign(p, props)
}

/**
 * Create proxied tcomb type representing a GraphQL type
 *
 * @param {Object} name - type name
 * @param {Object} desc - type description
 * @param {Object} props - type definition
 *
 * @return {Object} proxied tcomb type
 *
 * @example
 *
 *     const Thing = type('Thing', 'A Thing', { example: t.String })
 *     const ThingList = type('ThingList', 'A list of Things',  { things: t.list(t.maybe(Thing)) })
 */
export function type(name, __typeDesc, props, ...interfaces) {
  return proxy(t.struct(props, name), {__typeDesc, interfaces})
}

/**
 * Create proxied tcomb type representing a GraphQL input
 *
 * @param {Object} name - type name
 * @param {Object} desc - type description
 * @param {Object} props - type definition
 *
 * @return {Object} proxied tcomb type
 *
 * @example
 *
 *     const Input = type('ExampleInput', 'An integer input', { input: t.Integer })
 */
export function input(name, __typeDesc, props) {
  return proxy(t.struct(props, name), {__typeDesc, __input: true})
}

/**
 * Create proxied tcomb type representing a parameterized GraphQL type
 *
 * @param {Object} args - map of argument types
 * @param {Object} OutputType - return type
 * @param {Object} PubType - optional pubsub type
 * @param {Object} desc - optional type description
 *
 * @return {Object} proxied tcomb type
 *
 * @example
 *
 *     const SendMessageInput = input('SendMessageInput', 'sendMessage input', { text: t.String })
 *     const SendMessageOutput = type('SendMessageOutput', 'sendMessage response', { sent: t.Boolean })
 *     const messageSent = fn({ toId: t.ID }, Message)
 *     const sendMessage = fn({ input: SendMessageInput }, SendMessageOutput, messageSent, 'Send a message')
 */
export function fn(args, OutputType, __publishType, __desc) {
  return proxy(OutputType, {
    __args: args.meta && args.meta.props || args,
    __publishType,
    __desc})
}

/**
 * Create proxied tcomb type representing an argument for parameterized GraphQL types
 *
 * @param {Object} Type - tcomb type
 * @param {Object} val - optional default value
 * @param {Object} desc - optional type description
 *
 * @return {Object} proxied tcomb type
 *
 * @example
 *
 *     const mutateX = fn({
 *       y: arg(t.Integer, 10, 'Set X value (default 10)')
 *     }, MutateXOutput)
 */
export function arg(Type, __val, __desc) {
  return proxy(Type, __val === null ? {__desc} : {__val, __desc})
}

/**
 * Schema builder
 */
export default class TCombGraphQLSchema {
  constructor() {
    this.mutations = null
    this.queries = null
    this.resolvers = {}
    this.subscriptions = null
    this.shield = null
  }

  /**
   * Add mutations
   *
   * @param {Object} mutations
   *
   * @example
   *
   *     schema.addMutations({ sendMessage })
   */
  addMutations(mutations) {
    if (!this.mutations) {
      this.mutations = {}
    }
    for (const [k, type] of Object.entries(mutations)) {
      this.mutations[k] = type
      if (type.__publishType) {
        if (!this.subscriptions) {
          this.subscriptions = {}
        }
        this.subscriptions[k] = type.__publishType
      }
    }
  }

  /**
   * Add queries
   *
   * @param {Object} queries
   *
   * @example
   *
   *     schema.addQueries({
   *       message: fn({ id: t.ID }, t.maybe(Message), null, 'Fetch a message by ID')
   *     })
   */
  addQueries(queries) {
    if (!this.queries) {
      this.queries = {}
    }
    for (const [k, type] of Object.entries(queries)) {
      this.queries[k] = type
    }
  }

  /**
   * Add resolvers
   *
   * @param {Object} resolvers
   *
   * @example
   *
   *     schema.addResolvers({
   *       Query: { message: (parent, { _id }) => ... }
   *     })
   */
  addResolvers(resolvers) {
    this.resolvers = deepExtend(this.resolvers, resolvers)
  }

  /**
   * Add permissions (graphql-shield rules)
   *
   * @param {Object} permissions
   *
   * @example
   *
   *     schema.addPermissions({
   *       Query: { message: isAuthenticated }
   *     })
   */
  addPermissions(permissions) {
    this.shield = this.shield ? deepExtend(this.shield, permissions) : permissions
  }

  /**
   * Create query function
   *
   * @param {function} adapt - modify schema
   *
   * @return {function} function that executes a given GraphQL query
   *
   * @example
   *
   *     const exec = schema.compile(joinMonsterAdapter)
   *     exec(exampleQuery).then(...)
   */
  compile(adapt) {
    const schema = this.toGraphQL(adapt)
    return (...args) => graphql(schema, ...args)
  }

  /**
   * Print GraphQL schema
   *
   * @return {string} text representation of GraphQL schema
   */
  print() {
    return printSchema(this.toGraphQL())
  }

  /**
   * Create executable GraphQL schema
   *
   * @param {function} adapt - modify schema
   *
   * @return {Object} GraphQL schema
   *
   * @example
   *
   *     schema.toGraphQL(joinMonsterAdapter)
   */
  toGraphQL(adapt) {
    const config = {}
    if (this.queries) {
      config.query = transform(t.struct(this.queries, 'Query'), true)
    }
    if (this.mutations) {
      config.mutation = transform(t.struct(this.mutations, 'Mutation'), true)
    }
    if (this.subscriptions) {
      config.subscription = transform(t.struct(this.subscriptions, 'Subscription'), true)
    }
    const schema = new GraphQLSchema(config)
    addResolveFunctionsToSchema({ schema, resolvers: this.resolvers })
    if (this.shield) {
      applyMiddleware(schema, shield(this.shield, {
        fallback: 'Permission denied'
      }))
    }
    if (adapt) {
      adapt(schema)
    }
    return schema
  }
}
