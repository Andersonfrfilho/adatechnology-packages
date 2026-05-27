import 'reflect-metadata';
import { initTracing } from '@adatechnology/nestjs-logger';

initTracing({
  serviceName: 'example',
  otlp: { endpoint: 'http://jaeger:4318' },
});
