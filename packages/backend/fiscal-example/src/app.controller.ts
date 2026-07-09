import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      service: 'Fiscal Provider Example API',
      version: '0.0.1',
      status: 'running',
      docs: '/api/docs',
    }
  }

  @Get('health')
  health() {
    return { status: 'ok' }
  }
}
