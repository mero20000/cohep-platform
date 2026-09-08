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

  it('guest writes are denied as demo_read_only (portal + hymn-learning)', async () => {
    const demoRes = await request(app.getHttpServer())
      .post('/api/demo/session')
      .expect(201);
    const token = demoRes.body.accessToken;

    // Portal mutating routes pass the code check for the guest, so the
    // demo-aware guard must deny them explicitly.
    await request(app.getHttpServer())
      .post('/api/student-portal/demo-guest/practice')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);

    // Hymn-learning mutating routes are STAFF-only, so demo_viewer is denied.
    await request(app.getHttpServer())
      .post('/api/hymn-learning/practice')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });

  it('guest reads scoped to the demo school reject foreign studentId', async () => {
    const demoRes = await request(app.getHttpServer())
      .post('/api/demo/session')
      .expect(201);
    const token = demoRes.body.accessToken;

    // A studentId that does not belong to the demo school is rejected.
    await request(app.getHttpServer())
      .get('/api/hymn-learning/map?studentId=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('demo session minting is throttled (6th rapid POST -> 429)', async () => {
    // Fresh app instance so the throttle counter starts at zero.
    const throttledFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const throttledApp = throttledFixture.createNestApplication();
    throttledApp.setGlobalPrefix('api');
    await throttledApp.init();
    try {
      let lastStatus = 0;
      for (let i = 0; i < 6; i++) {
        const res = await request(throttledApp.getHttpServer()).post('/api/demo/session');
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      await throttledApp.close();
    }
  });
});
