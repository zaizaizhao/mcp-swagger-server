import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsObject,
  IsUUID,
  IsInt,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UserStatus } from '../../../database/entities/user.entity';
import { RoleType } from '../../../database/entities/role.entity';
import { PermissionCategory, PermissionAction } from '../../../database/entities/permission.entity';

import { AuditAction, AuditLevel, AuditStatus } from '../../../database/entities/audit-log.entity';

// 用户管理 DTOs
export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'john_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '用户名只能包含字母、数字、下划线和连字符' })
  username: string;

  @ApiProperty({ description: '邮箱地址', example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码', example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '密码必须包含至少一个小写字母、一个大写字母、一个数字和一个特殊字符'
  })
  password: string;

  @ApiPropertyOptional({ description: '名字', example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ description: '姓氏', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ description: '用户状态', enum: UserStatus, example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '角色ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ description: '用户偏好设置', type: 'object' })
  @IsOptional()
  @IsObject()
  preferences?: any;

  @ApiPropertyOptional({ description: '用户元数据', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: '是否验证邮箱', example: true })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '密码必须包含至少一个小写字母、一个大写字母、一个数字和一个特殊字符'
  })
  newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '重置令牌' })
  @IsString()
  token: string;

  @ApiProperty({ description: '新密码' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '密码必须包含至少一个小写字母、一个大写字母、一个数字和一个特殊字符'
  })
  newPassword: string;
}

export class UserQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '用户状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '角色ID' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '排序字段', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: '排序方向', enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// 角色管理 DTOs
export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: 'editor' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '角色名称只能包含字母、数字、下划线和连字符' })
  name: string;

  @ApiPropertyOptional({ description: '角色描述', example: '编辑者角色' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ description: '角色类型', enum: RoleType, example: RoleType.CUSTOM })
  @IsOptional()
  @IsEnum(RoleType)
  type?: RoleType;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '是否为默认角色', example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: '角色优先级', example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ description: '权限ID列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  permissionIds?: string[];

  @ApiPropertyOptional({ description: '角色元数据', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class RoleQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '角色类型', enum: RoleType })
  @IsOptional()
  @IsEnum(RoleType)
  type?: RoleType;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PermissionResponseDto {
  @ApiProperty({ description: '权限ID' })
  id: string;

  @ApiProperty({ description: '权限名称' })
  name: string;

  @ApiPropertyOptional({ description: '权限描述' })
  description?: string;

  @ApiProperty({ description: '权限分类', enum: PermissionCategory })
  category: PermissionCategory;

  @ApiProperty({ description: '权限操作', enum: PermissionAction })
  action: PermissionAction;

  @ApiPropertyOptional({ description: '资源名称' })
  resource?: string;

  @ApiProperty({ description: '是否启用' })
  enabled: boolean;

  @ApiProperty({ description: '是否系统权限' })
  isSystem: boolean;

  @ApiPropertyOptional({ description: '权限条件', type: 'object' })
  conditions?: any;

  @ApiPropertyOptional({ description: '权限元数据', type: 'object' })
  metadata?: any;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

// 权限管理 DTOs
export class CreatePermissionDto {
  @ApiProperty({ description: '权限名称', example: 'user:create' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_:-]+$/, { message: '权限名称只能包含字母、数字、下划线、冒号和连字符' })
  name: string;

  @ApiPropertyOptional({ description: '权限描述', example: '创建用户权限' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ description: '权限分类', enum: PermissionCategory, example: PermissionCategory.USER_MANAGEMENT })
  @IsEnum(PermissionCategory)
  category: PermissionCategory;

  @ApiProperty({ description: '权限操作', enum: PermissionAction, example: PermissionAction.CREATE })
  @IsEnum(PermissionAction)
  action: PermissionAction;

  @ApiPropertyOptional({ description: '资源名称', example: 'users' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resource?: string;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '权限条件', type: 'object' })
  @IsOptional()
  @IsObject()
  conditions?: any;

  @ApiPropertyOptional({ description: '权限元数据', type: 'object' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}

export class QueryPermissionsDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '权限分类', enum: PermissionCategory })
  @IsOptional()
  @IsEnum(PermissionCategory)
  category?: PermissionCategory;

  @ApiPropertyOptional({ description: '权限操作', enum: PermissionAction })
  @IsOptional()
  @IsEnum(PermissionAction)
  action?: PermissionAction;

  @ApiPropertyOptional({ description: '资源名称' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '是否系统权限' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({ description: '排序字段' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方向' })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PermissionQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '权限分类', enum: PermissionCategory })
  @IsOptional()
  @IsEnum(PermissionCategory)
  category?: PermissionCategory;

  @ApiPropertyOptional({ description: '权限操作', enum: PermissionAction })
  @IsOptional()
  @IsEnum(PermissionAction)
  action?: PermissionAction;

  @ApiPropertyOptional({ description: '资源名称' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}



// 审计日志 DTOs
export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '操作类型', enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: '日志级别', enum: AuditLevel })
  @IsOptional()
  @IsEnum(AuditLevel)
  level?: AuditLevel;

  @ApiPropertyOptional({ description: '操作状态', enum: AuditStatus })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: '资源类型' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: 'IP地址' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// 审计日志查询 DTOs
export class QueryAuditLogsDto {
  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: '操作类型', enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: '日志级别', enum: AuditLevel })
  @IsOptional()
  @IsEnum(AuditLevel)
  level?: AuditLevel;

  @ApiPropertyOptional({ description: '状态', enum: AuditStatus })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({ description: '资源类型' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ description: '资源ID' })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'IP地址' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '页码', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '排序字段', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: '排序方向', enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// 认证 DTOs
export class LoginDto {
  @ApiProperty({ description: '用户名或邮箱', example: 'john_doe' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码', example: 'SecurePassword123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: '记住登录', example: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RegisterDto {
  @ApiProperty({ description: '用户名', example: 'john_doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '用户名只能包含字母、数字、下划线和连字符' })
  username: string;

  @ApiProperty({ description: '邮箱地址', example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码', example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '密码必须包含至少一个小写字母、一个大写字母、一个数字和一个特殊字符'
  })
  password: string;

  @ApiPropertyOptional({ description: '名字', example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ description: '姓氏', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: '邮箱地址', example: 'john@example.com' })
  @IsEmail()
  email: string;
}

// 响应 DTOs
export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '邮箱地址' })
  email: string;

  @ApiPropertyOptional({ description: '名字' })
  firstName?: string;

  @ApiPropertyOptional({ description: '姓氏' })
  lastName?: string;

  @ApiProperty({ description: '用户状态', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: '是否验证邮箱' })
  emailVerified: boolean;

  @ApiPropertyOptional({ description: '最后登录时间' })
  lastLoginAt?: Date;

  @ApiProperty({ description: '角色列表', type: 'array' })
  roles: any[];

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class RoleResponseDto {
  @ApiProperty({ description: '角色ID' })
  id: string;

  @ApiProperty({ description: '角色名称' })
  name: string;

  @ApiPropertyOptional({ description: '角色描述' })
  description?: string;

  @ApiProperty({ description: '角色类型', enum: RoleType })
  type: RoleType;

  @ApiProperty({ description: '是否启用' })
  enabled: boolean;

  @ApiProperty({ description: '权限列表', type: 'array' })
  permissions: any[];

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}



export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '刷新令牌' })
  refreshToken: string;

  @ApiProperty({ description: '令牌类型', example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: '过期时间（秒）' })
  expiresIn: number;

  @ApiProperty({ description: '用户信息', type: UserResponseDto })
  user: UserResponseDto;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '数据列表', type: 'array' })
  data: T[];

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;

  @ApiProperty({ description: '是否有下一页' })
  hasNext: boolean;

  @ApiProperty({ description: '是否有上一页' })
  hasPrev: boolean;
}

export class OperationResultDto {
  @ApiProperty({ description: '操作是否成功' })
  success: boolean;

  @ApiProperty({ description: '消息' })
  message: string;

  @ApiPropertyOptional({ description: '操作数据', type: 'object' })
  data?: any;
}