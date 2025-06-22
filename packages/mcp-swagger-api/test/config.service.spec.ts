import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from '../src/config/app-config.service';
import { validationSchema } from '../src/config/validation.schema';

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          validationSchema,
          ignoreEnvFile: true,
        }),
      ],
      providers: [AppConfigService],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have default values', () => {
    expect(service.port).toBe(3001);
    expect(service.mcpPort).toBe(3322);
    expect(service.nodeEnv).toBeDefined();
  });

  it('should have configuration methods', () => {
    expect(typeof service.get).toBe('function');
    expect(typeof service.getAllConfig).toBe('function');
  });
});
