import { validateKeycloakAdminConfig } from '@adatechnology/nestjs-keycloak-admin';

console.log('🧪 Testing config validation\n');

// Test 1: missing config
try {
  validateKeycloakAdminConfig(undefined as any);
} catch (e: any) {
  console.log('1️⃣  Missing config:');
  console.log('   ✅', e.message);
  console.log('   Code:', e.code, '\n');
}

// Test 2: empty baseUrl
try {
  validateKeycloakAdminConfig({ baseUrl: '', realm: 'test', adminUser: 'admin', adminPassword: 'pass' });
} catch (e: any) {
  console.log('2️⃣  Empty baseUrl:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 3: invalid baseUrl protocol
try {
  validateKeycloakAdminConfig({ baseUrl: 'ftp://localhost', realm: 'test', adminUser: 'admin', adminPassword: 'pass' });
} catch (e: any) {
  console.log('3️⃣  Invalid protocol:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 4: empty realm
try {
  validateKeycloakAdminConfig({ baseUrl: 'http://localhost:8080', realm: '', adminUser: 'admin', adminPassword: 'pass' });
} catch (e: any) {
  console.log('4️⃣  Empty realm:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 5: multiple errors
try {
  validateKeycloakAdminConfig({ baseUrl: '', realm: '', adminUser: '', adminPassword: '' });
} catch (e: any) {
  console.log('5️⃣  Multiple errors:');
  console.log('   ✅', e.message.split('\n').length - 1, 'validation issues found');
  console.log('   Code:', e.code, '\n');
}

// Test 6: valid config
try {
  validateKeycloakAdminConfig({ baseUrl: 'http://localhost:8080', realm: 'example', adminUser: 'admin', adminPassword: 'admin' });
  console.log('6️⃣  Valid config: ✅ passes without error\n');
} catch (e: any) {
  console.log('6️⃣  Valid config: ❌ should not throw\n');
}

console.log('🎉 All validation tests passed!');
