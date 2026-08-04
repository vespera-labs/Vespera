import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KycStatusService } from '../kyc-status.service';
import { AuditService } from '../../audit/audit.service';
import {
  AuditAction,
  AuditLevel,
  AuditStatus,
} from '../../audit/entities/audit-log.entity';

export const SKIP_KYC_CHECK_KEY = 'skip_kyc_check';

/**
 * Guard that enforces KYC Verified + Screening Clear status
 * for all state-mutating endpoints. Apply to controllers that
 * handle payments, rent, and agreements.
 *
 * Use @SkipKycCheck() decorator to exempt specific endpoints.
 */
@Injectable()
export class KycEnforcementGuard implements CanActivate {
  private readonly logger = new Logger(KycEnforcementGuard.name);

  constructor(
    private readonly kycStatusService: KycStatusService,
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_KYC_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    const cleared = await this.kycStatusService.isCleared(user.id);

    if (!cleared) {
      this.logger.warn(
        `KYC enforcement denied for user ${user.id}: not cleared`,
      );

      await this.auditService.log({
        action: AuditAction.KYC_STATUS_CHANGED,
        entityType: 'User',
        entityId: user.id,
        performedBy: user.id,
        status: AuditStatus.FAILURE,
        level: AuditLevel.SECURITY,
        metadata: { reason: 'KYC_NOT_CLEARED', endpoint: context.getHandler().name },
      });

      throw new ForbiddenException('KYC_NOT_CLEARED');
    }

    return true;
  }
}
