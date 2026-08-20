import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get('JWT_SECRET') as string | undefined
        const nodeEnv = configService.get('NODE_ENV', 'development')
        const KNOWN_PLACEHOLDERS = [
          'your-super-secret-jwt-key-change-in-production',
          'your-production-jwt-secret',
          'change-me',
        ]
        if (nodeEnv === 'production' && (!secret || KNOWN_PLACEHOLDERS.includes(secret.trim().toLowerCase()))) {
          throw new Error('JWT_SECRET must be set to a strong, non-placeholder value in production')
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION', '15m'),
          },
        }
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginThrottleService, PasswordResetThrottleService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
