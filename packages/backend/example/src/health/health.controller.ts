import { Controller, Get } from '@nestjs/common';
import { ExcludeHttpLogging } from '@adatechnology/logger';

@ExcludeHttpLogging()
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
