import { Test, TestingModule } from '@nestjs/testing';
import { HymnLearningService } from './hymn-learning.service';
import { PrismaService } from '../../database/prisma.service';

describe('HymnLearningService - subject item recording on hymn map', () => {
  let svc: HymnLearningService;
  let prisma: any;

  const prismaMock = {
    lesson: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HymnLearningService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    svc = module.get<HymnLearningService>(HymnLearningService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('includes subjectItem recording url on hymn map', async () => {
    prisma.lesson.findMany = jest.fn().mockResolvedValue([{
      id: 'l1', title: 'H', level: { id: 'lv', number: 1, name: 'L1' },
      subject: { id: 's1', name: 'Coptic Hymns', color: '#000' },
      lessonProgress: [], resources: [], audioUrl: null,
      subjectItem: { id: 'si1', name: 'Hymn', recordingUrl: 'https://r/rec.mp3', recordingMeta: { originalName: 'rec.mp3' } },
    }]);
    const res = await svc.getStudentHymnMap('stu1', 'sch1');
    expect(res[0].referenceRecordingUrl).toBe('https://r/rec.mp3');
    expect(res[0].referenceRecordingName).toBe('rec.mp3');
  });
});
