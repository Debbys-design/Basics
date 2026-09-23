import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskManagerService } from './risk-manager.service';
import { RiskSettings } from './entities/risk-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskSettings])],
  providers: [RiskManagerService],
  exports: [RiskManagerService],
})
export class RiskManagerModule {}
