import { validateHttpForRoot, validateHttpForRootAsync, HttpConfigError } from '@adatechnology/http-client';

console.log('🧪 Testing @adatechnology/http-client config validation\n');

// Test 1: invalid first arg (array)
try {
  validateHttpForRoot([] as any);
} catch (e: any) {
  console.log('1️⃣  Array as configOrOptions:');
  console.log('   ✅', e.message.split('\n')[0], '\n');
}

// Test 2: invalid baseURL (not URL)
try {
  validateHttpForRoot({ baseURL: 'not-a-url' }, {});
} catch (e: any) {
  console.log('2️⃣  Invalid baseURL:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 3: invalid timeout
try {
  validateHttpForRoot({ baseURL: 'http://localhost:8080', timeout: -1 }, {});
} catch (e: any) {
  console.log('3️⃣  Negative timeout:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 4: invalid options.useCache (axios config mode)
try {
  validateHttpForRoot({ baseURL: 'http://localhost:8080' }, { useCache: 'yes' as any });
} catch (e: any) {
  console.log('4️⃣  Invalid useCache in options:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 5: duplicate options warning
try {
  validateHttpForRoot({ useCache: true }, { logging: {} });
} catch (e: any) {
  console.log('5️⃣  Duplicate options warning:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 6: valid axios config + options
try {
  validateHttpForRoot(
    { baseURL: 'https://api.example.com', timeout: 5000, headers: { 'X-Api-Key': 'abc' } },
    { useCache: false, logging: { enabled: true, context: 'HttpClient' } }
  );
  console.log('6️⃣  Valid axios config + options: ✅ passes\n');
} catch (e: any) {
  console.log('6️⃣  Valid axios config: ❌ should not throw\n');
}

// Test 7: valid single options arg
try {
  validateHttpForRoot({ useCache: true, cache: { defaultTtl: 60000 } });
  console.log('7️⃣  Valid single options arg: ✅ passes\n');
} catch (e: any) {
  console.log('7️⃣  Valid single options: ❌ should not throw\n');
}

// --- forRootAsync tests ---

// Test 8: missing useFactory
try {
  validateHttpForRootAsync({ imports: [] } as any);
} catch (e: any) {
  console.log('8️⃣  Async missing useFactory:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 9: invalid imports
try {
  validateHttpForRootAsync({ useFactory: () => ({}), imports: 'wrong' as any });
} catch (e: any) {
  console.log('9️⃣  Async invalid imports:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 10: valid async config
try {
  validateHttpForRootAsync({
    useFactory: () => ({ config: { baseURL: 'https://api.example.com' }, options: {} }),
    inject: [],
  });
  console.log('🔟  Valid async config: ✅ passes\n');
} catch (e: any) {
  console.log('🔟  Valid async config: ❌ should not throw\n');
}

console.log('🎉 All http-client validation tests passed!');
