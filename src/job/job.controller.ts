/* eslint-disable prettier/prettier */
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('submit')
  async submitJob(@Body('query') query: string) {
    const jobId = await this.jobService.submitJob(query);
    return { jobId };
  }

  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return await this.jobService.getJobStatus(jobId);
  }
}
