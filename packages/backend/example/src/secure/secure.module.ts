import { Module } from '@nestjs/common';
import { SecureController } from './secure.controller';
import { KeycloakModule } from '@adatechnology/auth-keycloak';

@Module({
  imports: [
    KeycloakModule,
  ],
  controllers: [SecureController],
})
export class SecureModule {}
