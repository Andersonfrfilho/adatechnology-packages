import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { FiscalModule } from './fiscal/fiscal.module'

@Module({
  imports: [FiscalModule],
  controllers: [AppController],
})
export class AppModule {}
