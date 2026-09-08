/**
 * Demo fixture verification runner (Task 5, fix round 1).
 *
 * Jest 29 cannot parse Nest 12 ESM repo-wide (pre-existing harness debt — do
 * NOT try to fix it here), so this script executes backend/test/demo.e2e-spec.ts
 * logic 1:1 via ts-node until the harness is fixed.
 *
 * Run (from backend/; backend/.env must point at the target database):
 *   npx ts-node --transpile-only -r tsconfig-paths/register --compiler-options '{"module":"commonjs","esModuleInterop":true}' test/demo-verify.runner.ts
 *
 * --transpile-only skips type-checking: src/modules/users/users.controller.ts
 * has a pre-existing duplicate-method type error (untouched by this task;
 * repo-wide tsc debt, same family as the broken Jest harness).
 *
 * Exit code 0 = ALL GREEN, 1 = failures (listed as FAIL lines).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

function decodePayload(token: string): any {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
}

async function main() {
  let failures = 0;
  const check = (name: string, ok: boolean, extra?: unknown) => {
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${JSON.stringify(extra)})` : ''}`);
    if (!ok) failures++;
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  const prisma: PrismaService = app.get(PrismaService);
  try {
    const usersBefore = await prisma.user.count({ where: { email: 'guest@demo' } });
    const demoRes = await request(app.getHttpServer()).post('/api/demo/session');
    check('POST /api/demo/session -> 201', demoRes.status === 201, { status: demoRes.status });
    const token: string | undefined = demoRes.body?.accessToken;
    check('accessToken present', typeof token === 'string' && token.length > 0);

    const usersAfter = await prisma.user.count({ where: { email: 'guest@demo' } });
    check('no user row created for guest', usersAfter === usersBefore, { usersBefore, usersAfter });

    if (token) {
      const payload = decodePayload(token);
      check('guest JWT carries code demo-guest', payload.code === 'demo-guest', { code: payload.code });
      check(
        'guest JWT is 30m demo_viewer',
        payload.role === 'demo_viewer' && payload.demo === true && payload.exp - payload.iat === 1800,
        { role: payload.role, demo: payload.demo, expMinusIat: payload.exp - payload.iat },
      );
    } else {
      check('guest JWT carries code demo-guest', false);
      check('guest JWT is 30m demo_viewer', false);
    }

    const school = await prisma.school.findUnique({ where: { slug: 'niangelos-demo' } });
    check('niangelos-demo school exists', !!school);
    if (school) {
      const hymns = await prisma.subjectItem.count({ where: { subject: { schoolId: school.id } } });
      check('8-hymn slice', hymns === 8, { hymns });
      const badges = await prisma.badge.count({ where: { schoolId: school.id } });
      check('10-badge slice', badges === 10, { badges });
      const demoStudent = await prisma.student.findFirst({
        where: { schoolId: school.id, portalAccessKey: 'demo-guest' },
        include: { level: { select: { number: true } }, group: { select: { name: true } } },
      });
      check('demo student seeded (Level 2, Group 1A)', !!demoStudent, {
        firstName: (demoStudent as any)?.firstName,
        level: (demoStudent as any)?.level?.number,
        group: (demoStudent as any)?.group?.name,
      });
    } else {
      check('8-hymn slice', false);
      check('10-badge slice', false);
      check('demo student seeded (Level 2, Group 1A)', false);
    }

    if (token) {
      const portalRes = await request(app.getHttpServer())
        .get('/api/student-portal/demo-guest')
        .set('Authorization', `Bearer ${token}`);
      const shapeOk =
        portalRes.status === 200 &&
        portalRes.body?.student?.firstName === 'Demo' &&
        portalRes.body?.student?.lastName === 'Student' &&
        portalRes.body?.student?.level?.number === 2 &&
        portalRes.body?.student?.group?.name === '1A';
      check('GET /api/student-portal/demo-guest -> 200 fixture shape', shapeOk, {
        status: portalRes.status,
        student: portalRes.body?.student
          ? {
              firstName: portalRes.body.student.firstName,
              lastName: portalRes.body.student.lastName,
              level: portalRes.body.student.level?.number,
              group: portalRes.body.student.group?.name,
            }
          : undefined,
      });

      const mapRes = await request(app.getHttpServer())
        .get('/api/hymn-learning/map')
        .set('Authorization', `Bearer ${token}`);
      check('GET /api/hymn-learning/map -> 200', mapRes.status === 200, { status: mapRes.status });

      const writeRes = await request(app.getHttpServer())
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      check('POST /api/attendance/sessions -> 403', writeRes.status === 403, { status: writeRes.status });
    } else {
      check('GET /api/student-portal/demo-guest -> 200 fixture shape', false);
      check('GET /api/hymn-learning/map -> 200', false);
      check('POST /api/attendance/sessions -> 403', false);
    }

    const anonRes = await request(app.getHttpServer()).get('/api/hymn-learning/map');
    check('GET map without token -> 401', anonRes.status === 401, { status: anonRes.status });

    // eslint-disable-next-line no-console
    console.log(failures === 0 ? 'ALL GREEN' : `${failures} FAILURES`);
  } finally {
    await app.close();
    await prisma.$disconnect().catch(() => {});
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Runner crashed:', e);
  process.exit(1);
});
