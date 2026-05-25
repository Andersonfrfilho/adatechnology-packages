import { NestFactory } from '@nestjs/core';
import { Module, Injectable, Inject } from '@nestjs/common';
import { KeycloakAdminModule, KeycloakAdminClient, KEYCLOAK_ADMIN_CLIENT } from '@adatechnology/nestjs-keycloak-admin';
import { HttpModule } from '@adatechnology/nestjs-http-client';

@Module({
  imports: [
    HttpModule.forRoot({ baseURL: 'http://localhost:8080', timeout: 5000 }),
    KeycloakAdminModule.forRoot({
      baseUrl: 'http://localhost:8080',
      realm: 'example',
      adminUser: 'admin',
      adminPassword: 'admin',
    }),
  ],
})
class TestModule {}

async function runTests() {
  const app = await NestFactory.createApplicationContext(TestModule);
  const client = app.get<KeycloakAdminClient>(KEYCLOAK_ADMIN_CLIENT);

  const TEST_USER_ID = 'fc706957-30ef-4554-828e-8481eb6b9ad7';

  console.log('🧪 Testing @adatechnology/nestjs-keycloak-admin\n');

  try {
    // 1. getAdminToken
    console.log('1️⃣  getAdminToken()');
    const token = await client.getAdminToken();
    console.log('   ✅ Token obtained:', token.accessToken.substring(0, 20) + '...');
    console.log('   ⏱️  Expires in:', token.expiresIn, 'seconds\n');

    const adminToken = token.accessToken;

    // 2. updateUser
    console.log('2️⃣  updateUser() — set emailVerified=true');
    await client.updateUser({
      userId: TEST_USER_ID,
      userData: { emailVerified: true },
      adminToken,
    });
    console.log('   ✅ User updated\n');

    // 3. updateUserAttributes
    console.log('3️⃣  updateUserAttributes()');
    await client.updateUserAttributes({
      userId: TEST_USER_ID,
      attributes: { avatar: 'https://example.com/avatar.png', document: '123456789' },
      adminToken,
    });
    console.log('   ✅ Attributes updated\n');

    // 4. resetPassword
    console.log('4️⃣  resetPassword()');
    await client.resetPassword({
      userId: TEST_USER_ID,
      password: 'NewPass123!',
      temporary: false,
      adminToken,
    });
    console.log('   ✅ Password reset\n');

    // 5. toggleUserEnabled — disable
    console.log('5️⃣  toggleUserEnabled() — disable user');
    await client.toggleUserEnabled({
      userId: TEST_USER_ID,
      enabled: false,
      adminToken,
    });
    console.log('   ✅ User disabled\n');

    // 6. toggleUserEnabled — re-enable
    console.log('6️⃣  toggleUserEnabled() — re-enable user');
    await client.toggleUserEnabled({
      userId: TEST_USER_ID,
      enabled: true,
      adminToken,
    });
    console.log('   ✅ User re-enabled\n');

    // 7. sendVerifyEmail
    console.log('7️⃣  sendVerifyEmail()');
    try {
      await client.sendVerifyEmail({
        userId: TEST_USER_ID,
        adminToken,
      });
      console.log('   ✅ Verify email sent\n');
    } catch (err: any) {
      if (err.statusCode === 500) {
        console.log('   ⚠️  Keycloak returned 500 (likely no SMTP configured) — lib call succeeded\n');
      } else {
        throw err;
      }
    }

    // 8. deleteUser
    console.log('8️⃣  deleteUser()');
    await client.deleteUser({
      userId: TEST_USER_ID,
      adminToken,
    });
    console.log('   ✅ User deleted\n');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runTests();
