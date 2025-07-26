import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../services/user.service';
import { User } from '../../../database/entities/user.entity';

export interface JwtPayload {
  sub: string; // 用户ID
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-key',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { sub: userId } = payload;

    try {
      const user = await this.userService.findUserById(userId);
      
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('用户账户已被禁用');
      }

      if (user.isLocked) {
        throw new UnauthorizedException('用户账户已被锁定');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('无效的访问令牌');
    }
  }
}