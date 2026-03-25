import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartPropertyListingWizardDto {
  @ApiPropertyOptional({
    description: 'Optional initial wizard payload',
    example: { basicInfo: { propertyType: 'apartment' } },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdatePropertyListingWizardStepDto {
  @ApiProperty({
    description: 'Wizard step number',
    example: 2,
    minimum: 1,
    maximum: 8,
  })
  @IsInt()
  @Min(1)
  @Max(8)
  step: number;

  @ApiProperty({
    description: 'Step payload',
    example: { pricing: { monthlyRent: 1200, leaseTermMonths: 12 } },
  })
  @IsNotEmpty()
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Completed steps so far',
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  completedSteps?: number[];
}

export class WizardDraftParamsDto {
  @ApiProperty({
    description: 'Draft id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;
}
