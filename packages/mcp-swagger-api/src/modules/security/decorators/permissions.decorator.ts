import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 权限装饰器
 * 用于在控制器方法上声明所需的权限
 * 
 * @param permissions 权限名称数组
 * @example
 * @RequirePermissions('user:read', 'user:write')
 * async getUsers() {}
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * 公开端点装饰器
 * 用于标记不需要认证的端点
 */
export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * 角色装饰器
 * 用于在控制器方法上声明所需的角色
 * 
 * @param roles 角色名称数组
 * @example
 * @RequireRoles('admin', 'moderator')
 * async deleteUser() {}
 */
export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

/**
 * 超级管理员装饰器
 * 用于标记只有超级管理员才能访问的端点
 */
export const SUPER_ADMIN_KEY = 'superAdminOnly';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_KEY, true);

/**
 * 用户自己或管理员装饰器
 * 用于标记用户只能访问自己的资源或管理员可以访问所有资源的端点
 */
export const SELF_OR_ADMIN_KEY = 'selfOrAdmin';
export const SelfOrAdmin = () => SetMetadata(SELF_OR_ADMIN_KEY, true);