import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../../../database/entities/user.entity';
import { Role, RoleType } from '../../../database/entities/role.entity';
import { AuditLog, AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  ResetPasswordDto,
  UserQueryDto,
  UserResponseDto,
  PaginatedResponseDto,
} from '../dto/security.dto';
import { AuditService } from './audit.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 创建用户
   */
  async createUser(
    createUserDto: CreateUserDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const { username, email, password, roleIds, ...userData } = createUserDto;

    // 检查用户名和邮箱是否已存在
    const existingUser = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (existingUser) {
      const field = existingUser.username === username ? '用户名' : '邮箱';
      throw new ConflictException(`${field}已存在`);
    }

    // 获取角色
    let roles: Role[] = [];
    if (roleIds && roleIds.length > 0) {
      roles = await this.roleRepository.findBy({ id: In(roleIds) });
      if (roles.length !== roleIds.length) {
        throw new BadRequestException('部分角色不存在');
      }
    } else {
      // 分配默认角色
      const defaultRole = await this.roleRepository.findOne({
        where: { name: 'GUEST', isDefault: true },
      });
      if (defaultRole) {
        roles = [defaultRole];
      }
    }

    // 创建用户
    const user = this.userRepository.create({
      username,
      email,
      password, // 密码会在实体的 @BeforeInsert 中自动哈希
      roles,
      ...userData,
    });

    const savedUser = await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_CREATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'users',
      resourceId: savedUser.id,
      ipAddress,
      details: {
        username: savedUser.username,
        email: savedUser.email,
        roles: roles.map(r => r.name),
      },
    });

    this.logger.log(`用户创建成功: ${savedUser.username} (${savedUser.id})`);

    return this.toResponseDto(savedUser);
  }

  /**
   * 更新用户
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<UserResponseDto> {
    const user = await this.findUserById(id);
    const { roleIds, ...updateData } = updateUserDto;

    // 检查用户名和邮箱冲突
    if (updateData.username || updateData.email) {
      const conditions: FindOptionsWhere<User>[] = [];
      if (updateData.username) {
        conditions.push({ username: updateData.username });
      }
      if (updateData.email) {
        conditions.push({ email: updateData.email });
      }

      const existingUser = await this.userRepository.findOne({
        where: conditions,
      });

      if (existingUser && existingUser.id !== id) {
        const field = existingUser.username === updateData.username ? '用户名' : '邮箱';
        throw new ConflictException(`${field}已存在`);
      }
    }

    // 更新角色
    if (roleIds) {
      const roles = await this.roleRepository.findBy({ id: In(roleIds) });
      if (roles.length !== roleIds.length) {
        throw new BadRequestException('部分角色不存在');
      }
      user.roles = roles;
    }

    // 更新用户数据
    Object.assign(user, updateData);
    const updatedUser = await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_UPDATED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'users',
      resourceId: updatedUser.id,
      ipAddress,
      details: {
        changes: updateData,
        roles: roleIds ? user.roles.map(r => r.name) : undefined,
      },
    });

    this.logger.log(`用户更新成功: ${updatedUser.username} (${updatedUser.id})`);

    return this.toResponseDto(updatedUser);
  }

  /**
   * 删除用户
   */
  async deleteUser(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const user = await this.findUserById(id);

    // 检查是否为系统用户
    if (user.roles.some(role => role.type === RoleType.SYSTEM)) {
      throw new BadRequestException('不能删除系统用户');
    }

    await this.userRepository.remove(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_DELETED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'users',
      resourceId: id,
      ipAddress,
      details: {
        username: user.username,
        email: user.email,
      },
    });

    this.logger.warn(`用户删除成功: ${user.username} (${id})`);
  }

  /**
   * 获取用户详情
   */
  async getUserById(id: string): Promise<UserResponseDto> {
    const user = await this.findUserById(id);
    return this.toResponseDto(user);
  }

  /**
   * 查询用户列表
   */
  async getUsers(query: UserQueryDto): Promise<PaginatedResponseDto<UserResponseDto>> {
    const {
      search,
      status,
      roleId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    // 搜索条件
    if (search) {
      queryBuilder.andWhere(
        '(user.username LIKE :search OR user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (roleId) {
      queryBuilder.andWhere('role.id = :roleId', { roleId });
    }

    // 排序
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // 分页
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map(user => this.toResponseDto(user)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;
    const user = await this.findUserById(userId);

    // 验证当前密码
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('当前密码不正确');
    }

    // 更新密码
    user.password = newPassword; // 会在 @BeforeUpdate 中自动哈希
    await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_PASSWORD_CHANGED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId || userId,
      resource: 'users',
      resourceId: userId,
      ipAddress,
      details: {
        username: user.username,
      },
    });

    this.logger.log(`用户密码修改成功: ${user.username} (${userId})`);
  }

  /**
   * 重置密码
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    ipAddress?: string,
  ): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    // 查找具有有效重置令牌的用户
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user || !user.passwordResetToken || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('重置令牌无效或已过期');
    }

    // 更新密码并清除重置令牌
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_PASSWORD_CHANGED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      resource: 'users',
      resourceId: user.id,
      ipAddress,
      details: {
        username: user.username,
      },
    });

    this.logger.log(`用户密码重置成功: ${user.username} (${user.id})`);
  }

  /**
   * 锁定用户
   */
  async lockUser(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const user = await this.findUserById(id);
    
    user.status = UserStatus.SUSPENDED;
    user.lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1小时后解锁
    await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_LOCKED,
      level: AuditLevel.WARNING,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'users',
      resourceId: id,
      ipAddress,
      details: {
        username: user.username,
      },
    });

    this.logger.warn(`用户锁定成功: ${user.username} (${id})`);
  }

  /**
   * 解锁用户
   */
  async unlockUser(
    id: string,
    operatorId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const user = await this.findUserById(id);
    
    user.status = UserStatus.ACTIVE;
    user.lockedUntil = null;
    user.loginAttempts = 0;
    await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      action: AuditAction.USER_UNLOCKED,
      level: AuditLevel.INFO,
      status: AuditStatus.SUCCESS,
      userId: operatorId,
      resource: 'users',
      resourceId: id,
      ipAddress,
      details: {
        username: user.username,
      },
    });

    this.logger.log(`用户解锁成功: ${user.username} (${id})`);
  }

  /**
   * 验证用户凭据
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [{ username }, { email: username }],
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      return null;
    }

    // 检查账户状态
    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用或锁定');
    }

    // 验证密码
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      // 增加失败登录次数
      await this.incrementFailedLoginAttempts(user.id);
      return null;
    }

    // 重置失败登录次数
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * 增加失败登录次数
   */
  private async incrementFailedLoginAttempts(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    user.loginAttempts += 1;

    // 如果失败次数达到阈值，锁定账户
    if (user.loginAttempts >= 5) {
      user.status = UserStatus.SUSPENDED;
      user.lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1小时后解锁
    }

    await this.userRepository.save(user);
  }

  /**
   * 根据ID查找用户
   */
  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(user: User): UserResponseDto {
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
   * 根据用户名或邮箱查找用户
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      relations: ['roles', 'roles.permissions'],
    });
  }

  /**
   * 生成密码重置令牌
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const token = user.generatePasswordResetToken();
    await this.userRepository.save(user);

    return token;
  }

  /**
   * 生成邮箱验证令牌
   */
  async generateEmailVerificationToken(userId: string): Promise<string> {
    const user = await this.findUserById(userId);
    const token = user.generateEmailVerificationToken();
    await this.userRepository.save(user);

    return token;
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('验证令牌无效');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    // 激活用户账户
    if (user.status === UserStatus.PENDING) {
      user.status = UserStatus.ACTIVE;
    }
    await this.userRepository.save(user);

    this.logger.log(`邮箱验证成功: ${user.email}`);
  }
}