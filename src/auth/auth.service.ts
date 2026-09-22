import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { User, UserRoles } from './decorators/current-user.decorator';

// In-memory mock DB store for illustrative purposes
const userDb = new Map<string, User>();

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    if (userDb.has(dto.email)) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user: User = {
      id: Date.now().toString(),
      email: dto.email,
      password: hashedPassword,
      roles: dto.roles && dto.roles.length ? dto.roles : [UserRoles.USER],
      hashedRefreshToken: null,
      name: dto.name,
    };

    userDb.set(dto.email, user);
    return this.generateTokens(user.id, user.email, user.roles);
  }

  async login(dto: LoginDto) {
    const user = userDb.get(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.email, tokens.refreshToken);
    return tokens;
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload: User = await this.jwtService.verifyAsync(
        dto.refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );

      const user = userDb.get(payload.email);
      if (!user || !user.hashedRefreshToken) {
        throw new UnauthorizedException('Access denied');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        dto.refreshToken,
        user.hashedRefreshToken,
      );
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Access denied');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.roles);
      await this.updateRefreshToken(user.email, tokens.refreshToken);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(userId: string, email: string, roles: string[]) {
    const payload = { sub: userId, email, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'access-secret-key',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key',
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(email: string, refreshToken: string) {
    const user = userDb.get(email);
    if (user) {
      user.hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      userDb.set(email, user);
    }
  }
}
