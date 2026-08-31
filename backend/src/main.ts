import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
// `import = require` rather than `import * as`: cookie-parser's export is a
// callable, and a namespace import gets wrapped in an interop object by SWC,
// which made `cookieParser()` throw "is not a function" at boot. This form
// compiles to a plain require under both tsc and SWC while keeping the types.
import cookieParser = require('cookie-parser');
import * as Sentry from '@sentry/node';
import { setDefaultResultOrder } from 'node:dns';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  // Resolve outbound hostnames over IPv4 first. Render's containers have no
  // IPv6 route; without this, smtp.gmail.com (which publishes AAAA records)
  // is tried on IPv6 first and every SMTP connect fails with ENETUNREACH.
  setDefaultResultOrder('ipv4first');

  // Sentry — only when a DSN is configured.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
    });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global prefix (health stays at the bare /health path for load balancers).
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Serve static uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  app.use(cookieParser());

  // Observability middleware — request ID first so the logger can tag lines.
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // CORS — explicit allowlist only. No wildcards, no null-origin passthrough.
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_2,
  ]
    .filter((o): o is string => !!o)
    .map((o) => o.replace(/\/$/, ''));

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow server-to-server / curl / same-origin requests with no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation (development only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('COHEP API')
      .setDescription('Coptic Orthodox Hymn Education Platform - API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('students', 'Student management')
      .addTag('curriculum', 'Curriculum management')
      .addTag('attendance', 'Attendance tracking')
      .addTag('assessments', 'Assessment system')
      .addTag('progress', 'Progress tracking')
      .addTag('gamification', 'Gamification system')
      .addTag('notifications', 'Notification system')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 COHEP API running on: http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
    console.log(`🏥 Health Check: http://localhost:${port}/health`);
  }
}
bootstrap();
