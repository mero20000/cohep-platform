import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Students (e2e)', () => {
  let app: INestApplication;
  let createdStudentId: string;
  let createdLevelId: string;
  let createdGroupId: string;
  let authToken: string;

  const testStudent = {
    firstName: 'E2E',
    lastName: 'TestUser',
    firstNameAr: 'إختبار',
    lastNameAr: 'مستخدم',
    dateOfBirth: '2015-06-15',
    gender: 'male',
    churchName: 'E2E Test Church',
    schoolGrade: 'Grade 5',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // Login to get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@niangelos.app', password: 'Admin123!', schoolIdentifier: 'niangelos-main' });

    authToken = loginRes.body.accessToken;

    // Get a level and group for our test student
    const levelsRes = await request(app.getHttpServer())
      .get('/api/students/levels/all')
      .set('Authorization', `Bearer ${authToken}`);

    if (levelsRes.body.length > 0) {
      createdLevelId = levelsRes.body[0].id;
    }

    // Get groups
    const groupsRes = await request(app.getHttpServer())
      .get('/api/students/groups/all')
      .set('Authorization', `Bearer ${authToken}`);

    const allGroups = groupsRes.body.flatMap(l => l.groups || []);
    if (allGroups.length > 0) {
      createdGroupId = allGroups[0].id;
    }
  });

  afterAll(async () => {
    // Cleanup: delete test student if still exists
    if (createdStudentId) {
      try {
        await request(app.getHttpServer())
          .delete(`/api/students/${createdStudentId}`)
          .set('Authorization', `Bearer ${authToken}`);
      } catch {}
    }

    await app.close();
  });

  // ===== GET /students =====
  describe('GET /api/students', () => {
    it('returns paginated students list', () => {
      return request(app.getHttpServer())
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toBeDefined();
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(20);
        });
    });

    it('supports search by name', () => {
      return request(app.getHttpServer())
        .get('/api/students?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data).toBeDefined();
          expect(res.body.pagination).toBeDefined();
        });
    });

    it('accepts level and group filters', () => {
      return request(app.getHttpServer())
        .get('/api/students?levelId=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data).toEqual([]);
        });
    });

    it('respects pagination params', () => {
      return request(app.getHttpServer())
        .get('/api/students?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.pagination.limit).toBe(5);
        });
    });
  });

  // ===== GET /students/levels/all =====
  describe('GET /api/students/levels/all', () => {
    it('returns levels array', () => {
      return request(app.getHttpServer())
        .get('/api/students/levels/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // ===== GET /students/groups/all =====
  describe('GET /api/students/groups/all', () => {
    it('returns groups by level', () => {
      return request(app.getHttpServer())
        .get('/api/students/groups/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0].groups).toBeDefined();
          }
        });
    });
  });

  // ===== POST /students =====
  describe('POST /api/students', () => {
    it('creates a new student (requires levelId and groupId)', async () => {
      if (!createdLevelId || !createdGroupId) {
        return; // Skip if no level/group available — not a test failure
      }

      const res = await request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testStudent, levelId: createdLevelId, groupId: createdGroupId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.studentCode).toBeDefined();
      expect(res.body.firstName).toBe('E2E');
      expect(res.body.lastName).toBe('TestUser');
      expect(res.body.status).toBe('active');

      createdStudentId = res.body.id;
    });

    it('rejects missing required fields (no firstName)', () => {
      return request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ lastName: 'OnlyLast' })
        .expect(400);
    });

    it('rejects invalid gender value', () => {
      return request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Bad',
          lastName: 'Data',
          dateOfBirth: '2015-01-01',
          gender: 'other',
          levelId: createdLevelId || '00000000-0000-0000-0000-000000000000',
          groupId: createdGroupId || '00000000-0000-0000-0000-000000000000',
        })
        .expect(400);
    });

    it('rejects invalid date format', () => {
      return request(app.getHttpServer())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Bad',
          lastName: 'Date',
          dateOfBirth: 'not-a-date',
          gender: 'male',
          levelId: createdLevelId || '00000000-0000-0000-0000-000000000000',
          groupId: createdGroupId || '00000000-0000-0000-0000-000000000000',
        })
        .expect(400);
    });
  });

  // ===== PUT /students/:id =====
  describe('PUT /api/students/:id', () => {
    it('updates a student', async () => {
      if (!createdStudentId) return;

      const res = await request(app.getHttpServer())
        .put(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'UpdatedE2E', churchName: 'Updated Church' })
        .expect(200);

      expect(res.body.firstName).toBe('UpdatedE2E');
      expect(res.body.churchName).toBe('Updated Church');
    });

    it('updates student status', async () => {
      if (!createdStudentId) return;

      const res = await request(app.getHttpServer())
        .put(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'graduated' })
        .expect(200);

      expect(res.body.status).toBe('graduated');
    });

    it('returns 404 for nonexistent student', () => {
      return request(app.getHttpServer())
        .put('/api/students/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Ghost' })
        .expect(404);
    });
  });

  // ===== GET /students/:id =====
  describe('GET /api/students/:id', () => {
    it('returns student by id', async () => {
      if (!createdStudentId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdStudentId);
    });

    it('returns 404 for nonexistent student', () => {
      return request(app.getHttpServer())
        .get('/api/students/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ===== DELETE /students/:id =====
  describe('DELETE /api/students/:id', () => {
    it('soft deletes a student', async () => {
      if (!createdStudentId) return;

      const res = await request(app.getHttpServer())
        .delete(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 for already deleted student', async () => {
      if (!createdStudentId) return;

      return request(app.getHttpServer())
        .delete(`/api/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ===== POST /students/groups =====
  describe('POST /api/students/groups', () => {
    it('creates a new group', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/students/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'E2E Test Group', nameAr: 'مجموعة اختبار' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Test Group');
      createdGroupId = res.body.id;
    });
  });

  // ===== PATCH /students/groups/:id =====
  describe('PATCH /api/students/groups/:id', () => {
    it('updates a group', async () => {
      if (!createdGroupId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/students/groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated E2E Group', status: 'inactive' })
        .expect(200);

      expect(res.body.name).toBe('Updated E2E Group');
      expect(res.body.status).toBe('inactive');
    });
  });
});
