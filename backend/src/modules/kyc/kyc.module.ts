import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kyc } from './kyc.entity';
import { KycPropagationOutbox } from './kyc-propagation-outbox.entity';
import { KycService } from './kyc.service';
import { KycStatusService } from './kyc-status.service';
import { KycPropagationService } from './kyc-propagation.service';
import { KycEnforcementGuard } from './guards/kyc-enforcement.guard';
import { KycController } from './kyc.controller';
import { UsersModule } from '../users/users.module';
import { SecurityModule } from '../security/security.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kyc, KycPropagationOutbox]),
    UsersModule,
    SecurityModule,
    AuditModule,
  ],
  providers: [KycService, KycStatusService, KycPropagationService, KycEnforcementGuard],
  controllers: [KycController],
  exports: [KycService, KycStatusService, KycPropagationService, KycEnforcementGuard],
})
export class KycModule {}
