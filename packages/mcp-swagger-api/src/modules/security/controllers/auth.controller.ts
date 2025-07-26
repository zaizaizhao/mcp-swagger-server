import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  LoginResponseDto,
  UserResponseDto,
  OperationResultDto,
} from '../dto/security.dto';
import { User } from '../../../database/entities/user.entity';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: '登录成功',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '用户名或密码错误',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '注册信息无效',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({
    status: 200,
    description: '令牌刷新成功',
  })
  @ApiResponse({
    status: 401,
    description: '刷新令牌无效',
  })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    return this.authService.refreshToken(refreshToken, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({
    status: 200,
    description: '登出成功',
  })
  async logout(
    @CurrentUser() user: User,
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || '';

    await this.authService.logout(user.id, refreshToken, ipAddress, userAgent);

    return {
      success: true,
      message: '登出成功',
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '忘记密码' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: '密码重置邮件已发送',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);

    await this.authService.forgotPassword(forgotPasswordDto, ipAddress);

    return {
      success: true,
      message: '如果邮箱存在，密码重置邮件已发送',
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证邮箱' })
  @ApiResponse({
    status: 200,
    description: '邮箱验证成功',
  })
  @ApiResponse({
    status: 400,
    description: '验证令牌无效或已过期',
  })
  async verifyEmail(
    @Query('token') token: string,
    @Req() req: Request,
  ): Promise<OperationResultDto> {
    const ipAddress = this.getClientIp(req);

    await this.authService.verifyEmail(token, ipAddress);

    return {
      success: true,
      message: '邮箱验证成功',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: UserResponseDto,
  })
  async getCurrentUser(
    @CurrentUser() user: User,
  ): Promise<UserResponseDto> {
    return this.authService.getCurrentUser(user.id);
  }

  @Get('check-permission')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查用户权限' })
  @ApiResponse({
    status: 200,
    description: '权限检查结果',
  })
  async checkPermission(
    @CurrentUser() user: User,
    @Query('permission') permission: string,
  ): Promise<{ hasPermission: boolean }> {
    const hasPermission = await this.authService.checkPermission(
      user.id,
      permission,
    );

    return { hasPermission };
  }

  @Get('check-role')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查用户角色' })
  @ApiResponse({
    status: 200,
    description: '角色检查结果',
  })
  async checkRole(
    @CurrentUser() user: User,
    @Query('role') role: string,
  ): Promise<{ hasRole: boolean }> {
    const hasRole = await this.authService.checkRole(user.id, role);

    return { hasRole };
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      ''
    );
  }
}