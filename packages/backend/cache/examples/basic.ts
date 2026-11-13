import { Cache } from '../src/index.js'

const cache = new Cache<string>({ ttlMs: 1000, maxSize: 3 })

cache.set('key1', 'value1')
cache.set('key2', 'value2')
cache.set('key3', 'value3')
cache.set('key4', 'value4')

console.log('After inserting 4 items (maxSize=3):')
console.log('  key1:', cache.get('key1'))
console.log('  key2:', cache.get('key2'))
console.log('  key3:', cache.get('key3'))
console.log('  key4:', cache.get('key4'))
console.log('  Size:', cache.size())

cache.set('k', 'short', 500)
console.log('\nTTL test — value before expire:', cache.get('k'))
console.log('Waiting 600ms...')
await new Promise((r) => setTimeout(r, 600))
console.log('Value after expire:', cache.get('k'))

cache.clear()
console.log('\nAfter clear — Size:', cache.size())
cache.destroy()
console.log('Cache destroyed')
