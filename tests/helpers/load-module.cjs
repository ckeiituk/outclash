const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

// Load the actual TypeScript modules with Electron/OS boundaries replaced. Each load has its
// own cache so tests exercise startup and migration state without touching a running client.
function loadModule(relative, stubs = {}, globals = {}) {
  const cache = new Map()
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const nativeRequire = createRequire(filename)
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name]
      const source = path.resolve(
        path.dirname(filename),
        `${name}${name.endsWith('.tsx') ? '' : '.ts'}`
      )
      if (name.startsWith('.') && fs.existsSync(source)) return load(source)
      return nativeRequire(name)
    }
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX
      }
    }).outputText
    const bindings = { window: undefined, setTimeout, clearTimeout, ...globals }
    const wrapper = vm.runInThisContext(
      `(function(require,module,exports,__filename,__dirname,${Object.keys(bindings).join(',')}){${compiled}\n})`,
      { filename }
    )
    wrapper(
      localRequire,
      module,
      module.exports,
      filename,
      path.dirname(filename),
      ...Object.values(bindings)
    )
    return module.exports
  }
  return load(path.join(root, relative))
}

module.exports = { loadModule }
