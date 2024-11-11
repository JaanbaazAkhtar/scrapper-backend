/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { JobProcessor } from './job.processor';
import { Job } from './job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    BullModule.registerQueue({
      name: 'jobQueue',
      limiter: {
        max: 5,
        duration: 1000 * 60,
      },
    }),
  ],
  providers: [JobService, JobProcessor],
  controllers: [JobController],
})
export class JobModule {}
