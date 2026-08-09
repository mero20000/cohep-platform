import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly passwordResetThrottle: PasswordResetThrottleService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, churchName, country, city, educationLanguage, mobileNumber, schoolIdentifier, firstNameAr, lastNameAr } = registerDto;

    let schoolId: string;

    if (schoolIdentifier) {
      // Existing school flow — direct registration
      schoolId = await this.resolveSchool(schoolIdentifier);
      const existingUser = await this.prisma.user.findFirst({
        where: { email, schoolId, deletedAt: null },
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists in this school');
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await this.prisma.user.create({
        data: {
          email, passwordHash, firstName, lastName,
          firstNameAr, lastNameAr, phone: mobileNumber,
          schoolId, locale: 'en', timezone: 'UTC', isActive: true,
        },
        select: { id: true, email: true, firstName: true, lastName: true, schoolId: true, createdAt: true },
      });
      const tokens = await this.generateTokens(user.id, email, schoolId);
      await this.storeRefreshToken(user.id, tokens.refreshToken);
      return { user, ...tokens };
    }

    // New church registration — pending review
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const schoolSlug = `${churchName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    // Create church + school in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const church = await tx.church.create({
        data: {
          name: churchName,
          nameAr: churchName,
          slug: schoolSlug,
          country,
          city,
          timezone: 'UTC',
          locale: educationLanguage === 'ar' ? 'ar' : 'en',
        },
      });

      const school = await tx.school.create({
        data: {
          churchId: church.id,
          name: churchName,
          slug: schoolSlug,
          country,
          city,
          educationLanguage,
          registrationStatus: 'pending',
          isActive: false,
          timezone: 'UTC',
          locale: educationLanguage === 'ar' ? 'ar' : 'en',
        },
      });

      const user = await tx.user.create({
        data: {
          email, passwordHash, firstName, lastName,
          firstNameAr, lastNameAr, phone: mobileNumber,
          schoolId: school.id,
          locale: educationLanguage === 'ar' ? 'ar' : 'en',
          timezone: 'UTC',
          isActive: false,
        },
        select: { id: true, email: true, firstName: true, lastName: true, schoolId: true, createdAt: true },
      });

      return { school, user };
    });

    // Notify super admin via email
    try {
      const adminEmail = this.configService.get('MAIL_TO', '');
      if (adminEmail) {
        await this.mailService.sendRegistrationNotification(adminEmail, {
          churchName,
          firstName,
          lastName,
          email,
          phone: mobileNumber,
          country,
          city,
        });
      }
    } catch {
      // email sending is optional
    }

    return {
      message: 'Registration submitted for review. You will be notified once your account is approved.',
      pending: true,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password, schoolIdentifier } = loginDto;

    // Per-account lockout — block before any work is done for a locked account.
    this.loginThrottle.assertNotLocked(email);

    let user;

    if (schoolIdentifier) {
      const schoolId = await this.resolveSchool(schoolIdentifier);
      user = await this.prisma.user.findFirst({
        where: { email, schoolId, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });
    } else {
      // No school given: prefer a super_admin account for this email. The same
      // address can exist across schools (e.g. promoted by seed in one school,
      // imported as a regular user in another); findFirst would otherwise pick
      // an arbitrary row and reject a valid super admin login.
      user = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, userRoles: { some: { role: { name: 'super_admin' } } } },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user) {
        user = await this.prisma.user.findFirst({
          where: { email, deletedAt: null },
          include: { userRoles: { include: { role: true } } },
        });
      }
      if (user && !user.userRoles.some((ur) => ur.role.name === 'super_admin')) {
        throw new BadRequestException('School identifier is required for this account');
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Only throttle real accounts — unknown emails are covered by the IP
      // limiter and recording them would let anyone lock arbitrary addresses.
      this.loginThrottle.recordFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Successful login clears any throttling state for this account.
    this.loginThrottle.clear(email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, email, user.schoolId);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const roles = user.userRoles.map((ur) => ur.role.name);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        roles,
        schoolId: user.schoolId,
      },
      ...tokens,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        schoolId: true,
        isActive: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  async refreshToken(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('Invalid refresh token');
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const stored = await this.prisma.refreshToken.findFirst({
        where: { userId: payload.sub, revokedAt: null, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      if (!stored) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const isValid = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (!isValid) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const user = await this.validateUser(payload.sub);
      const tokens = await this.generateTokens(user.id, user.email, user.schoolId);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async logoutByRefreshToken(refreshToken?: string) {
    if (!refreshToken) return { success: true };
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });
      await this.logout(payload.sub);
    } catch {
      // Cookie clearing should still succeed when the refresh token is expired or malformed.
    }
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true,
        avatarUrl: true, locale: true, timezone: true,
        isActive: true, lastLoginAt: true, createdAt: true,
        schoolId: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, roles: user.userRoles.map(ur => ur.role) };
  }

  async updateProfile(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.firstNameAr !== undefined && { firstNameAr: data.firstNameAr }),
        ...(data.lastNameAr !== undefined && { lastNameAr: data.lastNameAr }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.locale !== undefined && { locale: data.locale }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true,
        avatarUrl: true, locale: true, timezone: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
    return { success: true };
  }

  private static readonly RESET_TOKEN_TTL = '1h';

  async forgotPassword(
    dto: { email: string; schoolIdentifier?: string },
    origin?: string,
    ip?: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    this.passwordResetThrottle.assertAllowed(email, ip);

    let user: { id: string; email: string; schoolId: string; isActive: boolean } | null = null;

    if (dto.schoolIdentifier) {
      let schoolId: string;
      try {
        schoolId = await this.resolveSchool(dto.schoolIdentifier);
      } catch {
        // Unknown school identifier: treat like an unknown email so the response
        // never reveals account existence.
        return { message: 'If an account exists, a reset link was sent.' };
      }
      user = await this.prisma.user.findFirst({
        where: { email, schoolId, deletedAt: null },
        select: { id: true, email: true, schoolId: true, isActive: true },
      });
    } else {
      user = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, userRoles: { some: { role: { name: 'super_admin' } } } },
        select: { id: true, email: true, schoolId: true, isActive: true },
      });
      if (!user) {
        user = await this.prisma.user.findFirst({
          where: { email, deletedAt: null },
          select: { id: true, email: true, schoolId: true, isActive: true },
        });
      }
    }

    if (user && user.isActive) {
      const payload = { sub: user.id, email: user.email, purpose: 'password-reset' };
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: AuthService.RESET_TOKEN_TTL,
      });
      const base = (origin || this.configService.get('FRONTEND_URL') || 'https://cohep-platform.vercel.app').replace(/\/$/, '');
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await this.mailService.sendPasswordReset(user.email, resetUrl);
      } catch {
        // Email delivery is best-effort; never reveal send failures to the requester.
      }
    }

    return { message: 'If an account exists, a reset link was sent.' };
  }

  async verifyResetToken(token: string) {
    const payload = await this.decodeResetToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true, passwordChangedAt: true },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');
    if (user.passwordChangedAt && user.passwordChangedAt > new Date(payload.iat * 1000)) {
      throw new BadRequestException('This reset link has already been used');
    }
    return { email: this.maskEmail(user.email) };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = await this.decodeResetToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordChangedAt: true },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link');
    if (user.passwordChangedAt && user.passwordChangedAt > new Date(payload.iat * 1000)) {
      throw new BadRequestException('This reset link has already been used');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return { message: 'Password reset successfully. You can now sign in with your new password.' };
  }

  private async decodeResetToken(token: string): Promise<{ sub: string; iat: number }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (payload.purpose !== 'password-reset' || !payload.sub) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    return { sub: payload.sub, iat: payload.iat ?? 0 };
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const head = name.slice(0, 2);
    const dots = '•'.repeat(Math.max(0, Math.min(3, name.length - 2)));
    return `${head}${dots}@${domain}`;
  }

  private async resolveSchool(schoolIdentifier: string): Promise<string> {
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { id: schoolIdentifier },
          { slug: schoolIdentifier },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school.id;
  }

  async validateUserByCredentials(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      schoolId: user.schoolId,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  private async generateTokens(userId: string, email: string, schoolId: string) {
    const payload = { sub: userId, email, schoolId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async searchSchoolsPublic(q: string) {
    const query = (q || '').trim().toLowerCase()
    const schools = await this.prisma.school.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { nameAr: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { church: { name: { contains: query, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        church: { select: { name: true, nameAr: true, city: true, country: true } },
      },
      orderBy: { name: 'asc' },
      take: 8,
    });

    return schools.map((s: any) => ({
      slug: s.slug,
      name: s.name,
      nameAr: s.nameAr,
      churchName: s.church?.name,
      churchNameAr: s.church?.nameAr,
      city: s.church?.city,
      country: s.church?.country,
      label: [s.name, s.church?.name, s.church?.city].filter(Boolean).join(' · '),
    }));
  }

}