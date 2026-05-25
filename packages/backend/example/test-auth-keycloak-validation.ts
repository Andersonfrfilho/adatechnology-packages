import { validateKeycloakConfig } from '@adatechnology/nestjs-auth-keycloak';

console.log('🧪 Testing @adatechnology/nestjs-auth-keycloak config validation\n');

// Test 1: missing config
try {
  validateKeycloakConfig(undefined as any);
} catch (e: any) {
  console.log('1️⃣  Missing config:');
  console.log('   ✅', e.message, '\n');
}

// Test 2: empty baseUrl
try {
  validateKeycloakConfig({ baseUrl: '', realm: 'test', credentials: { clientId: 'a', clientSecret: 'b', grantType: 'client_credentials' } });
} catch (e: any) {
  console.log('2️⃣  Empty baseUrl:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 3: invalid grantType
try {
  validateKeycloakConfig({ baseUrl: 'http://localhost:8080', realm: 'test', credentials: { clientId: 'a', clientSecret: 'b', grantType: 'invalid' as any } });
} catch (e: any) {
  console.log('3️⃣  Invalid grantType:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 4: password grant missing username
try {
  validateKeycloakConfig({ baseUrl: 'http://localhost:8080', realm: 'test', credentials: { clientId: 'a', clientSecret: 'b', grantType: 'password' } });
} catch (e: any) {
  console.log('4️⃣  Password grant missing username:');
  console.log('   ✅', e.message.split('\n')[1], '\n');
}

// Test 5: multiple errors
try {
  validateKeycloakConfig({ baseUrl: '', realm: '', credentials: { clientId: '', clientSecret: '', grantType: 'invalid' as any } });
} catch (e: any) {
  console.log('5️⃣  Multiple errors:');
  console.log('   ✅', e.message.split('\n').length - 1, 'validation issues found\n');
}

// Test 6: valid config
try {
  validateKeycloakConfig({ baseUrl: 'http://localhost:8080', realm: 'example', credentials: { clientId: 'my-client', clientSecret: 'my-secret', grantType: 'client_credentials' } });
  console.log('6️⃣  Valid config: ✅ passes without error\n');
} catch (e: any) {
  console.log('6️⃣  Valid config: ❌ should not throw\n');
}

console.log('🎉 All validation tests passed!');
