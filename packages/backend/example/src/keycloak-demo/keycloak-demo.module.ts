import { Module } from '@nestjs/common';
import { KeycloakDemoService } from './keycloak-demo.service';
import { KeycloakDemoController } from './keycloak-demo.controller';

@Module({
  imports: [],
  providers: [KeycloakDemoService],
  controllers: [KeycloakDemoController],
})
export class KeycloakDemoModule {}
