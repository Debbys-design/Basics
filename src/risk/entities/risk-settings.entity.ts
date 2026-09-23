import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('risk_settings')
export class RiskSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'int', default: 10 })
  maxOpenPositions: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 50 })
  maxExposurePercentage: number;

  @Column({ type: 'boolean', default: true })
  requireStopLoss: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  minStopLossPercentage: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
