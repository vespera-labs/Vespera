
import {
  Controller, Get, Post, Body, Param, Query, Patch,
  Delete, Request, UseGuards, UseInterceptors, Headers,
  HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { CreatePaymentRecordDto } from "./dto/record-payment.dto";
import { CreatePaymentScheduleDto } from "./dto/create-payment-schedule.dto";
import { UpdatePaymentScheduleDto } from "./dto/update-payment-schedule.dto";
import { PaymentScheduleFiltersDto } from "./dto/payment-schedule-filters.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { AuditLogInterceptor } from "../audit/interceptors/audit-log.interceptor";

@ApiTags("Payments")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("payments")
@UseInterceptors(AuditLogInterceptor)
export class PaymentControllerSchedulePatch {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * FIX #22: process-due is now restricted to ADMIN role only.
   * Previously: JwtAuthGuard only — any authenticated user could trigger
   * charges against all other users payment schedules.
   * Now: Requires Role.ADMIN via RolesGuard. Non-admins receive 403.
   */
  @Post("schedules/process-due")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "[ADMIN ONLY] Process all due payment schedules",
    description:
      "Triggers immediate processing of all overdue recurring payment schedules. " +
      "Restricted to ADMIN role. Returns 403 for non-admin callers.",
  })
  @ApiResponse({ status: 200, description: "Due schedules processed" })
  @ApiResponse({ status: 403, description: "Forbidden - ADMIN role required" })
  async processDueSchedules(): Promise<{ processed: number }> {
    const result = await this.paymentService.processDueSchedules();
    return { processed: result };
  }
}
