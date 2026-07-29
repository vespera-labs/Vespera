import { SetMetadata } from '@nestjs/common';
import { SKIP_KYC_CHECK_KEY } from './kyc-enforcement.guard';

export const SkipKycCheck = () => SetMetadata(SKIP_KYC_CHECK_KEY, true);
