import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

/**
 * Anchor webhook payload. Only the fields listed here are persisted —
 * extra keys in the request body are ignored rather than spread into the
 * transaction's metadata, so an upstream change cannot inject arbitrary
 * data into our records.
 */
export class AnchorWebhookDto {
  /** Anchor's transaction id — used to locate the local record. */
  @IsString()
  @IsNotEmpty()
  id: string;

  /** Raw anchor status. Mapped to our enum in the service. */
  @IsString()
  @IsNotEmpty()
  status: string;

  /**
   * Idempotency key. Required to short-circuit replays. If the anchor
   * doesn't send an explicit event id we fall back to `${id}:${status}`,
   * which collapses identical re-deliveries while still permitting real
   * status transitions.
   */
  @IsOptional()
  @IsString()
  event_id?: string;

  /**
   * Monotonically increasing sequence from the anchor, when supplied.
   * Older sequences are rejected so a delayed delivery cannot regress
   * state.
   */
  @IsOptional()
  @IsNumber()
  sequence?: number;

  @IsOptional()
  @IsString()
  stellar_transaction_id?: string;

  @IsOptional()
  @IsString()
  external_transaction_id?: string;

  @IsOptional()
  @IsString()
  amount_in?: string;

  @IsOptional()
  @IsString()
  amount_out?: string;

  @IsOptional()
  @IsString()
  amount_fee?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
