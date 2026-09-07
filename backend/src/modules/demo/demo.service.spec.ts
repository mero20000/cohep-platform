import { Test } from '@nestjs/testing';
import { DemoService } from './demo.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

describe('DemoService', () => {
  it('mints a 30-min demo_viewer JWT without creating a user', async () => {
    const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') } as any;
    const prisma = { school: { upsert: jest.fn().mockResolvedValue({ id: 'demo-school-id' }) }, church: { findFirst: jest.fn().mockResolvedValue({ id: 'church-id' }) } } as any;
    const mod = await Test.createTestingModule({
      providers: [DemoService, { provide: JwtService, useValue: jwt }, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const svc = mod.get(DemoService);
    const res = await svc.mintGuestToken('1.2.3.4');
    expect(res.accessToken).toBe('jwt-token');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'demo-guest', role: 'demo_viewer', demo: true }),
      expect.objectContaining({ expiresIn: '30m' }),
    );
    expect(prisma.school.upsert).toHaveBeenCalled();
  });
});
