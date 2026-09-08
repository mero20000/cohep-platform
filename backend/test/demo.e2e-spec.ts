import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Demo guest (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('mints a guest session without creating a user row', async () => {
    const usersBefore = await prisma.user.count({
      where: { email: 'guest@demo' },
    });

    const demoRes = await request(app.getHttpServer())
      .post('/api/demo/session')
      .expect(201);

    expect(demoRes.body.accessToken).toBeDefined();

    const usersAfter = await prisma.user.count({
      where: { email: 'guest@demo' },
    });
    expect(usersAfter).toBe(usersBefore);
  });

  it('demo school fixture holds the 8-hymn / 10-badge slice', async () => {
    const school = await prisma.school.findUnique({
      where: { slug: 'niangelos-demo' },
    });
    expect(school).toBeDefined();

    const hymns = await prisma.subjectItem.count({
      where: { subject: { schoolId: school!.id } },
    });
    expect(hymns).toBe(8);

    const badges = await prisma.badge.count({
      where: { schoolId: school!.id },
    });
    expect(badges).toBe(10);
  });

  it('guest can read but cannot write', async () => {
    const demoRes = await request(app.getHttpServer())
      .post('/api/demo/session')
      .expect(201);
    const token = demoRes.body.accessToken;

    // Read: hymn map carries no @Roles gate, so any authenticated user —
    // including the synthetic demo_viewer — may read it.
    await request(app.getHttpServer())
      .get('/api/hymn-learning/map')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Write: attendance routes are STAFF-only, so demo_viewer is denied.
    await request(app.getHttpServer())
      .post('/api/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('guest reads the demo student portal fixture', async () => {
    const demoRes = await request(app.getHttpServer())
      .post('/api/demo/session')
      .expect(201);
    const token = demoRes.body.accessToken;

    // Guest JWT carries code:'demo-guest', matching the route param, so the
    // untouched StudentPortalAuthGuard lets it through to the seeded demo
    // student (Level 2, Group 1A).
    const res = await request(app.getHttpServer())
      .get('/api/student-portal/demo-guest')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.student.firstName).toBe('Demo');
    expect(res.body.student.lastName).toBe('Student');
    expect(res.body.student.level.number).toBe(2);
    expect(res.body.student.group.name).toBe('1A');
  });
});
