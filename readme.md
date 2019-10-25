# nonsynchronous

async/await callback fusioning utilities

## Functions

### Promisify

Implementation:

```js
const { promisify } = require('util')
```

The same [promisify](https://nodejs.org/dist/latest-v10.x/docs/api/util.html#util_util_promisify_original) as provided in Node core.

Example: 

```js
const { promisify } = require('nonsynchronous')
const fs = require('fs')
const stat = promisify(fs.stat)
async function run () {
  console.log(await stat('.'))
}
run()
```

### Once

Implementation:

```js
const once = require('events.once')
```

The same [once](https://nodejs.org/dist/latest-v10.x/docs/api/events.html#events_events_once_emitter_name) as provided in Node core (also polyfilled for earlier Node 10 versions).

Example: 

```js
const { once } = require('nonsynchronous')
const http = require('http')
async function run () {
  const server = http.createServer()
  server.listen()
  await once(server, 'listening')
  console.log(server.address())
}
run()
```

### When

Useful for when you want to explicitly use a callback based API within an async function. The function returned from `when`
must be called *after* awaiting the `done` method on that function
other wise an error `called before awaiting done()` will be thrown.

Implementation:

```js
const when = () => {
  var done = () => { throw Error('called before awaiting done()') }
  const fn = () => done()
  fn.done = promisify((cb) => { done = cb })
  return fn
}
```

Example: 

```js
const { when } = require('nonsynchronous')
async function run () {
  const until = when()
  setTimeout(() => {
    until()
  }, 1000)
  await until.done()
  console.log('timeout complete')
}
run()
```

### Whenify

Useful for using a callback based API within an async function
without any modifications required within the callback itself.

Must be used with a callback last API (for callback first, just use [`when`](#when) manually).

Used in conjunction with the [`done`](#done) symbol and optionally
the [`count`](#count) symbol. The `asyncOps` option is explored in the [`count`](#count) symbol documentation.

Implementation:

```js
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
```

Example: 

```js
const { whenify, done } = require('nonsynchronous')
const fs = require('fs')
async function run () {
  const stat = whenify(fs.stat)
  stat('.', (err, stats) => {
    console.log(err, stats)
  })
  await stat[done]
}
run()
```

### Whenify Method

Whenify an object method so that `method[done]` can be awaited (where `done` is the [`done`](#done) symbol). This can be particularly useful when writing tests for an instance with callback based methods. The test be both self documenting and async compatible.

Implementation:

```js
const whenifyMethod = (instance, method, opts) => {
  const result = whenify(instance[method].bind(instance), opts)
  instance[method] = result
  return instance
}
```

Example: 

```js
const { whenifyMethod, done } = require('nonsynchronous')
const fs = require('fs')
whenifyMethod(fs, 'stat')
async function run () {
  fs.stat('.', (err, stats) => {
    console.log(err, stats)
  })
  await fs.stat[done]
}
run()
```

### Promisify Method

Convert a callback-based method on an instance into its
promisifed equivalent. Can be passed multiple method names
to easily promisify entire instances.

Implementation:

```js
const _promisifyMethod = (instance, method) => {
  const result = promisify(instance[method])
  instance[method] = result
  return instance
}
const promisifyMethod = (instance, ...methods) => {
  methods.forEach(_promisifyMethod.bind(null, instance))
  return instance
}
```

Example: 

```js
const { promisifyMethod } = require('nonsynchronous')
const http = require('http')
async function run () {
  const server = http.createServer()
  promisifyMethod(server, 'listen')
  await server.listen()
  console.log(server.address())
}
run()
```

### Promisify Of

Partially apply a promisify of a particular method on any given instance
without mutating the instance. This is useful as an alternative to `promisifyMethod` if you don't want to overwrite instance keys and/or 
you have multiple different instances that you want to promisify the same
method of.

Implementation:

```js
const promisifyOf = (method) => {
  return (instance) => promisify((...args) => instance[method](...args))
}
```

Example:

```js
const { promisifyOf } = require('nonsynchronous')
const http = require('http')
async function run () {
  const server = http.createServer()
  const listen = promisifyOf('listen')
  await listen(server)(2000) // listen on port 2000
  console.log(server.address())
}
run()
```


### Immediate

Promisified `setImmediate`.

Implementation:

```js
const immediate = promisify(setImmediate)
```

Example:

```js
const { immediate } = require('nonsynchronous')
async function run () {
  console.log('this tick')
  await immediate()
  console.log('next tick')
}
run()
```

### Timeout

Promisified `setTimeout`.

Implementation:

```js
const timeout = promisify(setTimeout)
```


Example:

```js
const { timeout } = require('nonsynchronous')
async function run () {
  await timeout(1000)
  console.log('timeout complete')
}
run()
```

## Symbols

### Done

The `done` symbol is used with [`whenify`](#whenify) and [`whenifyMethod`](#whenify-method)
to access a promise on the function that has been whenified
which can be awaited. The promise will complete once the
callback for a whenified function has been called.

### Count

The `count` symbol is  used with [`whenify`](#whenify) and [`whenifyMethod`](#whenify-method) to access a the total amount
of times a whenified functions callback was called. This is
only useful when you set the `asyncOps` option to greater
than 1. 

```js
const { whenify, done, count } = require('nonsynchronous')
const multiCallbackThing = whenify(
  require('multi-callback-thing'),
  {asyncOps: 3} // expecting three calls of the callback
)
async function run () {
  multiCallbackThing(() => {
    // how many times has this cb been called so far?
    // note: the count is zero indexed.
    console.log(`called ${multiCallbackThing[count] + 1} times`) 
  })
}
run()
```

### Custom Promisify Args

The `customPromisifyArgs` symbol exposes a Node core symbol used
to alter [`promisify`](#promisify) behaviour for callbacks then
have extra arguments.

```js
const { promisify, customPromisifyArgs } = require('nonsynchronous')
const multiArgApi = (cb) => setImmediate(cb, null, 'circle', 'red')
multiArgApi[customPromisifyArgs] = ['shape', 'color']
const multiValApi = promisify(multiArgApi)

async function run () {
  const { shape, color } = await multiValApi()
  console.log(`shape: ${shape}\ncolor: ${color}`)
}
run()
```

## Behaviors

Automatically includes and enable [make-promisies-safe](https://npm.im/make-promises-safe) which causes Node to treat unhandled rejections as unhandled exceptions (e.g. throws and exits).

## Tests & Coverage

```sh
npm test
```

```
Suites:   1 passed, 1 of 1 completed
Asserts:  24 passed, of 24
----------|----------|----------|----------|----------|-------------------|
File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
----------|----------|----------|----------|----------|-------------------|
All files |      100 |      100 |      100 |      100 |                   |
 index.js |      100 |      100 |      100 |      100 |                   |
----------|----------|----------|----------|----------|-------------------|
```

## License

MIT