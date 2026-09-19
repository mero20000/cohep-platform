import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { PrismaService } from '../../database/prisma.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

describe('GradeDisputesService', () => {
  let service: GradeDisputesService;
  let prisma: any;
  let notificationsService: any;

  const prismaMock = {
    assessmentSubmission: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    gradeDispute: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    grade: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const notificationsMock = { notify: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradeDisputesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StudentNotificationsService, useValue: notificationsMock },
      ],
    }).compile();

    service = module.get<GradeDisputesService>(GradeDisputesService);
    prisma = module.get(PrismaService);
    notificationsService = module.get(StudentNotificationsService);
    jest.clearAllMocks();
  });

  describe('createDispute', () => {
    const createData = {
      schoolId: 'school-1',
      submissionId: 'sub-1',
      requestedById: 'student-1',
      reason: 'Grade seems incorrect',
    };

    const mockSubmission = {
      id: 'sub-1',
      studentId: 'student-1',
      grades: [{ id: 'grade-1', score: 80 }],
      student: { id: 'student-1', firstName: 'John', lastName: 'Doe' },
    };

    it('should create a dispute when submission found with grades', async () => {
      prismaMock.assessmentSubmission.findUnique.mockResolvedValue(mockSubmission);
      prismaMock.user.findUnique.mockResolvedValue({ userRoles: [{ role: { name: 'student' } }] });
      prismaMock.gradeDispute.findFirst.mockResolvedValue(null);

      const createdDispute = { id: 'dispute-1', ...createData, gradeId: 'grade-1' };
      prismaMock.gradeDispute.create.mockResolvedValue(createdDispute);

      const result = await service.createDispute(createData);

      expect(result).toEqual(createdDispute);
      expect(prismaMock.assessmentSubmission.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        include: { grades: true, student: true },
      });
      expect(prismaMock.gradeDispute.findFirst).toHaveBeenCalledWith({
        where: { submissionId: 'sub-1', status: 'pending' },
      });
      expect(prismaMock.gradeDispute.create).toHaveBeenCalledWith({
        data: {
          schoolId: 'school-1',
          submissionId: 'sub-1',
          gradeId: 'grade-1',
          requestedById: 'student-1',
          reason: 'Grade seems incorrect',
        },
        include: {
          submission: { include: { student: true, assessment: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    it('should throw NotFoundException when submission not found', async () => {
      prismaMock.assessmentSubmission.findUnique.mockResolvedValue(null);

      await expect(service.createDispute(createData)).rejects.toThrow(NotFoundException);
      await expect(service.createDispute(createData)).rejects.toThrow('Submission not found');
    });

    it('should throw ForbiddenException when student tries to dispute another student\'s submission', async () => {
      const otherStudentSubmission = {
        ...mockSubmission,
        studentId: 'other-student',
      };
      prismaMock.assessmentSubmission.findUnique.mockResolvedValue(otherStudentSubmission);
      prismaMock.user.findUnique.mockResolvedValue({ userRoles: [{ role: { name: 'student' } }] });

      await expect(service.createDispute(createData)).rejects.toThrow(ForbiddenException);
      await expect(service.createDispute(createData)).rejects.toThrow('You can only dispute your own submissions');
    });

    it('should throw BadRequestException when no grade found', async () => {
      const submissionNoGrades = { ...mockSubmission, grades: [] };
      prismaMock.assessmentSubmission.findUnique.mockResolvedValue(submissionNoGrades);
      prismaMock.user.findUnique.mockResolvedValue({ userRoles: [{ role: { name: 'student' } }] });

      await expect(service.createDispute(createData)).rejects.toThrow(BadRequestException);
      await expect(service.createDispute(createData)).rejects.toThrow('No grade found for this submission');
    });

    it('should throw BadRequestException when pending dispute already exists', async () => {
      prismaMock.assessmentSubmission.findUnique.mockResolvedValue(mockSubmission);
      prismaMock.user.findUnique.mockResolvedValue({ userRoles: [{ role: { name: 'student' } }] });
      prismaMock.gradeDispute.findFirst.mockResolvedValue({ id: 'existing-dispute' });

      await expect(service.createDispute(createData)).rejects.toThrow(BadRequestException);
      await expect(service.createDispute(createData)).rejects.toThrow(
        'A pending dispute already exists for this submission',
      );
    });
  });

  describe('listDisputes', () => {
    const mockDisputes = [
      { id: 'dispute-1', schoolId: 'school-1', status: 'pending' },
      { id: 'dispute-2', schoolId: 'school-1', status: 'responded' },
    ];

    it('should return disputes with default limit 50', async () => {
      prismaMock.gradeDispute.findMany.mockResolvedValue(mockDisputes);

      const result = await service.listDisputes('school-1');

      expect(result).toEqual(mockDisputes);
      expect(prismaMock.gradeDispute.findMany).toHaveBeenCalledWith({
        where: { schoolId: 'school-1' },
        include: {
          submission: { include: { student: true, assessment: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
          respondedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should cap limit at 100', async () => {
      prismaMock.gradeDispute.findMany.mockResolvedValue(mockDisputes);

      await service.listDisputes('school-1', { limit: 200 });

      expect(prismaMock.gradeDispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should filter by status and requestedById when provided', async () => {
      prismaMock.gradeDispute.findMany.mockResolvedValue([mockDisputes[0]]);

      await service.listDisputes('school-1', { status: 'pending', requestedById: 'student-1', limit: 10 });

      expect(prismaMock.gradeDispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId: 'school-1', status: 'pending', requestedById: 'student-1' },
          take: 10,
        }),
      );
    });
  });

  describe('respondToDispute', () => {
    const respondData = {
      respondedById: 'teacher-1',
      response: 'Grade has been reviewed and updated',
      newScore: 90,
    };

    const mockDispute = {
      id: 'dispute-1',
      status: 'pending',
      submission: {
        studentId: 'student-1',
        student: { id: 'student-1', firstName: 'John', lastName: 'Doe' },
        grades: [{ id: 'grade-1', score: 80 }],
      },
    };

    it('should respond to dispute with transaction and notify student', async () => {
      prismaMock.gradeDispute.findUnique.mockResolvedValue(mockDispute);
      prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));

      const updatedDispute = {
        ...mockDispute,
        status: 'responded',
        respondedById: 'teacher-1',
        response: respondData.response,
      };
      prismaMock.gradeDispute.update.mockResolvedValue(updatedDispute);

      const result = await service.respondToDispute('dispute-1', respondData);

      expect(result).toEqual(updatedDispute);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.gradeDispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: expect.objectContaining({
          status: 'responded',
          respondedById: 'teacher-1',
          response: respondData.response,
          newScore: 90,
        }),
        include: {
          submission: { include: { student: true } },
          respondedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      expect(prismaMock.grade.update).toHaveBeenCalledWith({
        where: { id: 'grade-1' },
        data: { score: 90 },
      });
      expect(notificationsMock.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          type: 'grade_dispute_responded',
          referenceId: 'dispute-1',
        }),
      );
    });

    it('should not update grade when newScore is not provided', async () => {
      prismaMock.gradeDispute.findUnique.mockResolvedValue(mockDispute);
      prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));

      const updatedDispute = { ...mockDispute, status: 'responded' };
      prismaMock.gradeDispute.update.mockResolvedValue(updatedDispute);

      await service.respondToDispute('dispute-1', {
        respondedById: 'teacher-1',
        response: 'Grade is correct',
      });

      expect(prismaMock.grade.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when dispute not found', async () => {
      prismaMock.gradeDispute.findUnique.mockResolvedValue(null);

      await expect(service.respondToDispute('nonexistent', respondData)).rejects.toThrow(NotFoundException);
      await expect(service.respondToDispute('nonexistent', respondData)).rejects.toThrow('Dispute not found');
    });

    it('should throw BadRequestException when dispute already responded to', async () => {
      const respondedDispute = { ...mockDispute, status: 'responded' };
      prismaMock.gradeDispute.findUnique.mockResolvedValue(respondedDispute);

      await expect(service.respondToDispute('dispute-1', respondData)).rejects.toThrow(BadRequestException);
      await expect(service.respondToDispute('dispute-1', respondData)).rejects.toThrow(
        'Dispute already responded to',
      );
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending disputes for a school', async () => {
      prismaMock.gradeDispute.count.mockResolvedValue(5);

      const result = await service.getPendingCount('school-1');

      expect(result).toBe(5);
      expect(prismaMock.gradeDispute.count).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', status: 'pending' },
      });
    });
  });
});
