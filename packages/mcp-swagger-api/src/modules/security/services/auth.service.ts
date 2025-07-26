import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserStatus } from '../../../database/entities/user.entity';
import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  LoginResponseDto,
  UserResponseDto,
} from '../dto/security.dto';
import { UserService } from './user.service';
import { AuditService } from './audit.service';
import { RoleService } from './role.service';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
    private readonly roleService: RoleService,
  ) {}

  /**
   * 用户登录
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponseDto> {
    const { username, password, rememberMe } = loginDto;

    try {
      // 验证用户凭据
      const user = await this.userService.validateUser(username, password);
      if (!user) {
        await this.auditService.logUserLogin(
          undefined,
          ipAddress,
          userAgent,
          false,
          { username, reason: '用户名或密码错误' },
        );
        throw new UnauthorizedException('用户名或密码错误');
      }

      // 检查用户状态
      if (user.status !== UserStatus.ACTIVE) {
        await this.auditService.logUserLogin(
          user.id,
          ipAddress,
          userAgent,
          false,
          { username, reason: '账户已被禁用或锁定' },
        );
        throw new UnauthorizedException('账户已被禁用或锁定');
      }

      // 生成令牌
      const tokens = await this.generateTokens(user, rememberMe);

      // 更新最后登录时间
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      // 记录成功登录
      await this.auditService.logUserLogin(
        user.id,
        ipAddress,
        userAgent,
        true,
        { username },
      );

      this.logger.log(`用户登录成功: ${user.username} (${user.id})`);

      return {
        ...tokens,
        user: this.toUserResponseDto(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('登录过程中发生错误', error);
      throw new UnauthorizedException('登录失败');
    }
  }

  /**
   * 用户注册
   */
  async register(
    registerDto: RegisterDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<UserResponseDto> {
    try {
      // 创建用户
      const user = await this.userService.createUser(
        {
          ...registerDto,
          status: UserStatus.PENDING, // 新注册用户需要验证
        },
        undefined,
        ipAddress,
      );

      // 生成邮箱验证令牌
      const verificationToken = await this.userService.generateEmailVerificationToken(
        user.id,
      );

      // TODO: 发送验证邮件
      // await this.emailService.sendVerificationEmail(user.email, verificationToken);

      // 记录审计日志
      await this.auditService.log({
        action: AuditAction.USER_CREATED,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        resource: 'auth',
        ipAddress,
        userAgent,
        details: {
          username: registerDto.username,
          email: registerDto.email,
        },
      });

      this.logger.log(`用户注册成功: ${registerDto.username}`);

      return user;
    } catch (error) {
      // 记录注册失败
      await this.auditService.log({
        action: AuditAction.USER_CREATED,
        level: AuditLevel.ERROR,
        status: AuditStatus.FAILED,
        resource: 'auth',
        ipAddress,
        userAgent,
        details: {
          username: registerDto.username,
          email: registerDto.email,
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 刷新令牌
   */
  async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    try {
      // 验证刷新令牌
      const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // 检查令牌是否在存储中
      const storedToken = this.refreshTokens.get(payload.tokenId);
      if (!storedToken || storedToken.userId !== payload.sub) {
        throw new UnauthorizedException('刷新令牌无效');
      }

      // 检查令牌是否过期
      if (storedToken.expiresAt < new Date()) {
        this.refreshTokens.delete(payload.tokenId);
        throw new UnauthorizedException('刷新令牌已过期');
      }

      // 获取用户信息
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('用户不存在或已被禁用');
      }

      // 删除旧的刷新令牌
      this.refreshTokens.delete(payload.tokenId);

      // 生成新的令牌
      const tokens = await this.generateTokens(user);

      // 记录令牌刷新
      await this.auditService.log({
        action: AuditAction.USER_LOGIN,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        userId: user.id,
        resource: 'auth',
        ipAddress,
        userAgent,
      });

      return tokens;
    } catch (error) {
      this.logger.error('刷新令牌失败', error);
      throw new UnauthorizedException('刷新令牌无效');
    }
  }

  /**
   * 用户登出
   */
  async logout(
    userId: string,
    refreshToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // 如果提供了刷新令牌，从存储中删除
      if (refreshToken) {
        try {
          const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
            secret: process.env.JWT_REFRESH_SECRET,
          });
          this.refreshTokens.delete(payload.tokenId);
        } catch (error) {
          // 忽略无效的刷新令牌
        }
      }

      // 记录登出
      await this.auditService.logUserLogout(userId, ipAddress, userAgent);

      this.logger.log(`用户登出成功: ${userId}`);
    } catch (error) {
      this.logger.error('登出过程中发生错误', error);
    }
  }

  /**
   * 忘记密码
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    ipAddress: string,
  ): Promise<void> {
    const { email } = forgotPasswordDto;

    try {
      // 生成密码重置令牌
      const resetToken = await this.userService.generatePasswordResetToken(email);

      // TODO: 发送重置邮件
      // await this.emailService.sendPasswordResetEmail(email, resetToken);

      // 记录审计日志
      await this.auditService.log({
        action: AuditAction.USER_PASSWORD_CHANGED,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        resource: 'auth',
        ipAddress,
        details: { email },
      });

      this.logger.log(`密码重置请求: ${email}`);
    } catch (error) {
      // 即使用户不存在，也不要暴露这个信息
      this.logger.warn(`密码重置请求失败: ${email}`, error);
    }
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(
    token: string,
    ipAddress: string,
  ): Promise<void> {
    try {
      await this.userService.verifyEmail(token);

      // 记录审计日志
      await this.auditService.log({
        action: AuditAction.USER_UPDATED,
        level: AuditLevel.INFO,
        status: AuditStatus.SUCCESS,
        resource: 'auth',
        ipAddress,
        details: { token: token.substring(0, 8) + '...' },
      });

      this.logger.log('邮箱验证成功');
    } catch (error) {
      // 记录验证失败
      await this.auditService.log({
        action: AuditAction.USER_UPDATED,
        level: AuditLevel.ERROR,
        status: AuditStatus.FAILED,
        resource: 'auth',
        ipAddress,
        details: {
          token: token.substring(0, 8) + '...',
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 验证JWT令牌
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['roles', 'roles.permissions'],
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error('JWT令牌验证失败', error);
      return null;
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return this.toUserResponseDto(user);
  }

  /**
   * 检查用户权限
   */
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return false;
    }

    return user.hasPermission(permission);
  }

  /**
   * 检查用户角色
   */
  async checkRole(userId: string, role: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return false;
    }

    return user.hasRole(role);
  }

  /**
   * 生成访问令牌和刷新令牌
   */
  private async generateTokens(
    user: User,
    rememberMe: boolean = false,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    // 获取用户权限
    const permissions = user.permissions;
    const roles = user.roles?.map(role => role.name) || [];

    // JWT载荷
    const jwtPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions,
    };

    // 生成访问令牌
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    // 生成刷新令牌
    const tokenId = crypto.randomUUID();
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
    };

    const refreshTokenExpiresIn = rememberMe ? '30d' : '7d';
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: refreshTokenExpiresIn,
    });

    // 存储刷新令牌
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));
    this.refreshTokens.set(tokenId, {
      userId: user.id,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 15分钟（秒）
    };
  }

  /**
   * 转换为用户响应DTO
   */
  private toUserResponseDto(user: User): UserResponseDto {
    const { password, passwordResetToken, emailVerificationToken, ...userData } = user;
    return {
      ...userData,
      roles: user.roles?.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        type: role.type,
      })) || [],
    } as UserResponseDto;
  }

  /**
   * 清理过期的刷新令牌
   */
  async cleanupExpiredRefreshTokens(): Promise<void> {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [tokenId, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.expiresAt < now) {
        expiredTokens.push(tokenId);
      }
    }

    for (const tokenId of expiredTokens) {
      this.refreshTokens.delete(tokenId);
    }

    if (expiredTokens.length > 0) {
      this.logger.log(`清理了 ${expiredTokens.length} 个过期的刷新令牌`);
    }
  }

  /**
   * 撤销用户的所有刷新令牌
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const revokedTokens: string[] = [];

    for (const [tokenId, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.userId === userId) {
        this.refreshTokens.delete(tokenId);
        revokedTokens.push(tokenId);
      }
    }

    this.logger.log(`撤销了用户 ${userId} 的 ${revokedTokens.length} 个刷新令牌`);
  }

  /**
   * 获取在线用户统计
   */
  getOnlineUsersCount(): number {
    const uniqueUsers = new Set();
    for (const tokenData of this.refreshTokens.values()) {
      uniqueUsers.add(tokenData.userId);
    }
    return uniqueUsers.size;
  }
}