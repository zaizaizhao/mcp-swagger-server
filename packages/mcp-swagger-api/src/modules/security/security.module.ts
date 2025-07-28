import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

// Entities
import { User } from '../../database/entities/user.entity';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

// Services
import { UserService } from './services/user.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { AuditService } from './services/audit.service';
import { AuthService } from './services/auth.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { RoleController } from './controllers/role.controller';
import { PermissionController } from './controllers/permission.controller';
import { AuditController } from './controllers/audit.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      AuditLog,
      RefreshToken,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Core
    Reflector,
    
    // Services
    UserService,
    RoleService,
    PermissionService,
    AuditService,
    AuthService,
    
    // Guards
    JwtAuthGuard,
    PermissionsGuard,
    
    // Strategies
    JwtStrategy,
  ],
  controllers: [
    AuthController,
    UserController,
    RoleController,
    PermissionController,
    AuditController,
  ],
  exports: [
    UserService,
    RoleService,
    PermissionService,
    AuditService,
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class SecurityModule {}