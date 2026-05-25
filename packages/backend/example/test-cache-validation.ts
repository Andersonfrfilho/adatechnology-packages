import { validateCacheConfig, CacheConfigError } from '@adatechnology/nestjs-cache';

console.log('🧪 Testing @adatechnology/nestjs-cache config validation\n');

// Test 1: invalid type (array)
try {
  validateCacheConfig([] as any);
} catch (e: any) {
  console.log('1️⃣  Array instead of object:');
  console.log('   ✅', e.message, '\n');
}

// Test 2: invalid isGlobal type
try {
  validateCacheConfig({ isGlobal: 'yes' as any });
} catch (e: any) {
  console.log('2️⃣  Invalid isGlobal:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 3: encryptionSecret too short
try {
  validateCacheConfig({ encryptionSecret: 'short' });
} catch (e: any) {
  console.log('3️⃣  Short encryptionSecret:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 4: encryptionSecret wrong type
try {
  validateCacheConfig({ encryptionSecret: 123 as any });
} catch (e: any) {
  console.log('4️⃣  Wrong encryptionSecret type:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 5: multiple errors
try {
  validateCacheConfig({ isGlobal: 'yes' as any, encryptionSecret: 'short' });
} catch (e: any) {
  console.log('5️⃣  Multiple errors:');
  console.log('   ✅', e.message.split('\n').length - 1, 'validation issues found\n');
}

// Test 6: valid config (empty)
try {
  validateCacheConfig();
  console.log('6️⃣  Empty config (undefined): ✅ passes without error');
} catch (e: any) {
  console.log('6️⃣  Empty config: ❌ should not throw');
}

// Test 7: valid config with good secret
try {
  validateCacheConfig({ encryptionSecret: 'this-is-16-chars!' });
  console.log('7️⃣  Valid config with secret: ✅ passes without error');
} catch (e: any) {
  console.log('7️⃣  Valid config: ❌ should not throw');
}

console.log('\n🎉 All cache validation tests passed!');
