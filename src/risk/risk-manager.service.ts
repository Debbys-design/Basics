import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskSettings } from './entities/risk-settings.entity';
import { UpdateRiskSettingsDto } from './dto/risk-settings.dto';

export interface Position {
  id: string;
  entryPrice: number;
  size: number;
  stopLoss?: number;
}

export interface TradeRequest {
  entryPrice: number;
  size: number;
  stopLoss?: number;
  balance: number;
}

export interface RiskValidationResult {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_MAX_OPEN_POSITIONS = 10;
const DEFAULT_MAX_EXPOSURE_PERCENTAGE = 50;
const DEFAULT_REQUIRE_STOP_LOSS = true;
const DEFAULT_MIN_STOP_LOSS_PERCENTAGE = 5;
const MAX_STOP_LOSS_PERCENTAGE = 20;

@Injectable()
export class RiskManagerService {
  private readonly logger = new Logger(RiskManagerService.name);

  constructor(
    @InjectRepository(RiskSettings)
    private readonly riskSettingsRepository: Repository<RiskSettings>,
  ) {}

  async getRiskSettings(userId: string): Promise<RiskSettings> {
    let settings = await this.riskSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.riskSettingsRepository.create({
        userId,
        maxOpenPositions: DEFAULT_MAX_OPEN_POSITIONS,
        maxExposurePercentage: DEFAULT_MAX_EXPOSURE_PERCENTAGE,
        requireStopLoss: DEFAULT_REQUIRE_STOP_LOSS,
        minStopLossPercentage: DEFAULT_MIN_STOP_LOSS_PERCENTAGE,
      });
      settings = await this.riskSettingsRepository.save(settings);
    }

    return settings;
  }

  async updateRiskSettings(
    userId: string,
    dto: UpdateRiskSettingsDto,
  ): Promise<RiskSettings> {
    const settings = await this.getRiskSettings(userId);

    if (dto.maxOpenPositions !== undefined) {
      settings.maxOpenPositions = dto.maxOpenPositions;
    }
    if (dto.maxExposurePercentage !== undefined) {
      settings.maxExposurePercentage = dto.maxExposurePercentage;
    }
    if (dto.requireStopLoss !== undefined) {
      settings.requireStopLoss = dto.requireStopLoss;
    }
    if (dto.minStopLossPercentage !== undefined) {
      settings.minStopLossPercentage = dto.minStopLossPercentage;
    }

    return this.riskSettingsRepository.save(settings);
  }

  calculateTotalExposure(positions: Position[]): number {
    return positions.reduce(
      (total, position) => total + position.entryPrice * position.size,
      0,
    );
  }

  private validateStopLoss(
    trade: TradeRequest,
    settings: RiskSettings,
  ): RiskValidationResult {
    if (settings.requireStopLoss && trade.stopLoss === undefined) {
      return { allowed: false, reason: 'Stop-loss is required' };
    }

    if (trade.stopLoss === undefined) {
      return { allowed: true };
    }

    const distancePercentage =
      (Math.abs(trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100;

    if (distancePercentage < settings.minStopLossPercentage) {
      return {
        allowed: false,
        reason: `Stop-loss must be at least ${settings.minStopLossPercentage}% from entry`,
      };
    }

    if (distancePercentage > MAX_STOP_LOSS_PERCENTAGE) {
      return {
        allowed: false,
        reason: `Stop-loss must be at most ${MAX_STOP_LOSS_PERCENTAGE}% from entry`,
      };
    }

    return { allowed: true };
  }

  async validateTrade(
    userId: string,
    trade: TradeRequest,
    openPositions: Position[],
  ): Promise<RiskValidationResult> {
    const settings = await this.getRiskSettings(userId);

    if (openPositions.length >= settings.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Maximum open positions (${settings.maxOpenPositions}) reached`,
      };
    }

    const stopLossResult = this.validateStopLoss(trade, settings);
    if (!stopLossResult.allowed) {
      return stopLossResult;
    }

    const currentExposure = this.calculateTotalExposure(openPositions);
    const newExposure = currentExposure + trade.entryPrice * trade.size;
    const maxExposure =
      (trade.balance * settings.maxExposurePercentage) / 100;

    if (newExposure > maxExposure) {
      return {
        allowed: false,
        reason: `Total exposure exceeds ${settings.maxExposurePercentage}% of balance`,
      };
    }

    const potentialLoss = trade.stopLoss
      ? Math.abs(trade.entryPrice - trade.stopLoss) * trade.size
      : trade.entryPrice * trade.size;

    if (potentialLoss > trade.balance) {
      return {
        allowed: false,
        reason: 'Insufficient balance for potential loss',
      };
    }

    return { allowed: true };
  }
}
