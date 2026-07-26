import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/auth/login with valid credentials returns token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@niangelos.app', password: 'Admin123!', schoolIdentifier: 'niangelos-main' })
        .expect(200)
        .expect(res => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(res.body.user).toBeDefined();
          expect(res.body.user.roles).toContain('super_admin');
        });
    });

    it('POST /api/auth/login with invalid credentials returns 401', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@niangelos.app', password: 'wrong', schoolIdentifier: 'niangelos-main' })
        .expect(401);
    });

    it('GET /api/students without token returns 401', () => {
      return request(app.getHttpServer())
        .get('/api/students')
        .expect(401);
    });

    it('GET /api/students with valid token returns 200', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@niangelos.app', password: 'Admin123!', schoolIdentifier: 'niangelos-main' })
        .expect(200);

      return request(app.getHttpServer())
        .get('/api/students?limit=1')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
          expect(res.body.pagination).toBeDefined();
        });
    });
  });
});
