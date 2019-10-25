'use strict'

const { promisify } = require('util')
const once = require('events.once')
const done = Symbol('done')
const count = Symbol('count')
const customPromisifyArgs = (() => {
  var result
  promisify(new Proxy(Function, { get (_, p) {
    if (/PromisifyArgs/.test(p.toString())) result = p
  } }))
  return result
})()

const when = () => {
  var done = () => { throw Error('called before awaiting done()') }
  const fn = () => done()
  fn.done = promisify((cb) => { done = cb })
  return fn
}
const whenify = (fn, { asyncOps } = { asyncOps: 1 }) => {
  const until = when()
  const max = asyncOps - 1
  const result = (...args) => {
    const cb = args.pop()
    return fn(...args, (...args) => {
      cb(...args) // eslint-disable-line
      if (++result[count] > max) until()
    })
  }
  result[count] = 0
  Object.defineProperty(result, done, {
    get () { return until.done() }
  })
  return result
}
const whenifyMethod = (instance, method, opts) => {
  const result = whenify(instance[method].bind(instance), opts)
  instance[method] = result
  return instance
}

const promisifyOf = (method) => {
  return (instance) => promisify((...args) => instance[method](...args))
}

const _promisifyMethod = (instance, method) => {
  const result = promisify(instance[method])
  instance[method] = result
  return instance
}
const promisifyMethod = (instance, ...methods) => {
  methods.forEach(_promisifyMethod.bind(null, instance))
  return instance
}
const immediate = promisify(setImmediate)
const timeout = promisify(setTimeout)

module.exports = {
  done,
  count,
  customPromisifyArgs,
  when,
  whenify,
  whenifyMethod,
  promisifyMethod,
  promisify,
  promisifyOf,
  immediate,
  timeout,
  once
}
