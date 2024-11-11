/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { Job } from './job.entity';
import { JobStatus } from './job-status.enum';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @InjectRepository(Job)
    private jobRepository: Repository<Job>,
    @InjectQueue('jobQueue')
    private jobQueue: Queue
  ) {}

  async submitJob(query: string): Promise<string> {
    const job = new Job();
    job.query = query;
    job.status = JobStatus.PENDING;
    await this.jobRepository.save(job);

    await this.jobQueue.add('processJob', { jobId: job.id });
    this.logger.log(`Job ${job.id} submitted with query: "${query}"`);
    return job.id;
  }

  async getJobStatus(jobId: string) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new Error(`Job with ID ${jobId} not found`);

    return {
      status: job.status,
      results: job.status === JobStatus.COMPLETED ? job.results : null,
      error: job.status === JobStatus.FAILED ? job.error : null,
    };
  }
}
