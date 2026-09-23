import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateRiskSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxOpenPositions?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxExposurePercentage?: number;

  @IsOptional()
  @IsBoolean()
  requireStopLoss?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  minStopLossPercentage?: number;
}

export class RiskSettingsResponseDto {
  userId: string;
  maxOpenPositions: number;
  maxExposurePercentage: number;
  requireStopLoss: boolean;
  minStopLossPercentage: number;
}
