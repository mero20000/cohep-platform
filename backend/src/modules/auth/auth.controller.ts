import { Controller, Post, Get, Patch, Body, UseGuards, Request, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto, ChangePasswordDto } from '../users/dto/users.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private readonly cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'none' | 'lax' | 'strict' | boolean;
    path: string;
  } = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('token', tokens.accessToken, { ...this.cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', tokens.refreshToken, { ...this.cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('token', this.cookieOptions);
    res.clearCookie('refreshToken', this.cookieOptions);
  }

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    if ('accessToken' in result && 'refreshToken' in result) {
      this.setAuthCookies(res, result);
      const { accessToken, refreshToken, ...body } = result;
      return body;
    }
    return result;
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result);
    const { accessToken, refreshToken, ...body } = result;
    return body;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = refreshTokenDto?.refreshToken || req.cookies?.refreshToken || this.readCookie(req.headers?.cookie, 'refreshToken');
    const result = await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, result);
    return { success: true };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken || this.readCookie(req.headers?.cookie, 'refreshToken');
    this.clearAuthCookies(res);
    return this.authService.logoutByRefreshToken(refreshToken);
  }

  private readCookie(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return undefined;
    const prefix = `${name}=`;
    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}
