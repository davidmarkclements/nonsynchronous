'use strict'
const http = require('http')
const { test } = require('tap')
const {
  promisify,
  once,
  when,
  whenify,
  whenifyMethod,
  promisifyMethod,
  promisifyOf,
  immediate,
  timeout,
  count,
  done,
  customPromisifyArgs
} = require('.')

test('promisify', async ({ is }) => {
  const api = (cb) => setImmediate(cb, null, 'test')
  const nonsync = promisify(api)
  is(await nonsync(), 'test')
})
test('once', async ({ isNot }) => {
  const server = http.createServer()
  server.listen()
  await once(server, 'listening')
  isNot(server.address(), null)
  server.close()
})
test('when', async ({ is }) => {
  const until = when()
  var complete = false
  setTimeout(() => {
    complete = true
    until()
  }, 1000)
  is(complete, false)
  await until.done()
  is(complete, true)
})
test('when – called prior to awaiting done()', async ({ throws }) => {
  const until = when()
  throws(() => until(), Error('called before awaiting done()'))
})
test('whenify', async ({ is }) => {
  const api = (cb) => setImmediate(cb, null, 'test')
  const nonsync = whenify(api)
  var complete = false
  nonsync((err, result) => {
    complete = true
    is(err, null)
    is(result, 'test')
  })
  is(complete, false)
  await nonsync[done]
  is(complete, true)
})
test('whenifyMethod', async ({ is }) => {
  const api = { method: (cb) => setImmediate(cb, null, 'test') }
  whenifyMethod(api, 'method')
  var complete = false
  api.method((err, result) => {
    complete = true
    is(err, null)
    is(result, 'test')
  })
  is(complete, false)
  await api.method[done]
  is(complete, true)
})
test('promisifyMethod', async ({ isNot }) => {
  const server = http.createServer()
  promisifyMethod(server, 'listen')
  await server.listen()
  isNot(server.address(), null)
  server.close()
})
test('immediate', async ({ is }) => {
  var c = 1
  setImmediate(() => {
    is(c, 1)
    c++
  })
  await immediate()
  is(c, 2)
})
test('timeout', async ({ is }) => {
  var c = 1
  setTimeout(() => {
    is(c, 1)
    c++
  }, 0)
  await timeout(0)
  is(c, 2)
})

test('count', async ({ is }) => {
  const nonsync = whenify(
    (cb) => {
      setImmediate(cb)
      setImmediate(cb)
    },
    { asyncOps: 2 } // expecting three calls of the callback
  )
  var c = 0
  nonsync(() => {
    is(nonsync[count], c)
    c++
  })
  await nonsync[done]
  is(c, 2)
  is(nonsync[count], 2)
})
test('custom Promisify Args', async ({ is }) => {
  const multiArgApi = (cb) => setImmediate(cb, null, 'circle', 'red')
  multiArgApi[customPromisifyArgs] = ['shape', 'color']
  const multiValApi = promisify(multiArgApi)
  const { shape, color } = await multiValApi()
  is(shape, 'circle')
  is(color, 'red')
})

test('promisifyOf', async ({ isNot }) => {
  const server = http.createServer()
  const listen = promisifyOf('listen')
  await listen(server)()
  isNot(server.address(), null)
  server.close()
})
