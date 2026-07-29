import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard';
import {
  WebhookSignatureService,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '../webhook-signature.service';
import { WEBHOOK_SECRET_METADATA_KEY } from '../decorators/webhook-secret.decorator';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  let webhookSignatureService: WebhookSignatureService;
  let reflector: Reflector;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ANCHOR_WEBHOOK_SECRET') return 'test-secret';
      if (key === 'WEBHOOK_SIGNATURE_SECRET') return 'test-secret';
      return undefined;
    }),
  };

  const makeContext = (
    headers: Record<string, string | undefined>,
    body: any = {},
  ): ExecutionContext => {
    const request = {
      header: (name: string) => headers[name.toLowerCase()],
      headers: Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
      ),
      body,
      rawBody: JSON.stringify(body),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSignatureGuard,
        WebhookSignatureService,
        Reflector,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<WebhookSignatureGuard>(WebhookSignatureGuard);
    webhookSignatureService = module.get<WebhookSignatureService>(
      WebhookSignatureService,
    );
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('valid signature', () => {
    it('passes when signature is valid', () => {
      const payload = JSON.stringify({ id: 'tx-1', status: 'completed' });
      const timestamp = Date.now().toString();
      const signature = webhookSignatureService.generateSignature(
        payload,
        timestamp,
        'test-secret',
      );

      const context = makeContext(
        {
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
        },
        { id: 'tx-1', status: 'completed' },
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('missing signature', () => {
    it('throws UnauthorizedException when signature header is missing', () => {
      const context = makeContext(
        {
          [WEBHOOK_TIMESTAMP_HEADER]: Date.now().toString(),
        },
        {},
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when timestamp header is missing', () => {
      const context = makeContext(
        {
          [WEBHOOK_SIGNATURE_HEADER]: 'some-sig',
        },
        {},
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when both headers are missing', () => {
      const context = makeContext({}, {});

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('invalid signature', () => {
    it('throws UnauthorizedException when signature does not match', () => {
      const payload = JSON.stringify({ id: 'tx-1' });
      const timestamp = Date.now().toString();

      const context = makeContext(
        {
          [WEBHOOK_SIGNATURE_HEADER]:
            '0000000000000000000000000000000000000000000000000000000000000000',
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
        },
        { id: 'tx-1' },
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('stale timestamp', () => {
    it('throws UnauthorizedException when timestamp is too old', () => {
      const payload = JSON.stringify({ id: 'tx-1' });
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
      const signature = webhookSignatureService.generateSignature(
        payload,
        oldTimestamp,
        'test-secret',
      );

      const context = makeContext(
        {
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: oldTimestamp,
        },
        { id: 'tx-1' },
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('missing secret', () => {
    it('throws when webhook secret is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const payload = JSON.stringify({ id: 'tx-1' });
      const timestamp = Date.now().toString();
      const signature = webhookSignatureService.generateSignature(
        payload,
        timestamp,
        'any-secret',
      );

      const context = makeContext(
        {
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
        },
        { id: 'tx-1' },
      );

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      // The service throws UnauthorizedException for missing signature
      // or InternalServerErrorException for missing secret — either way
      // the guard blocks the request.
      expect(() => guard.canActivate(context)).toThrow();
    });
  });
});
