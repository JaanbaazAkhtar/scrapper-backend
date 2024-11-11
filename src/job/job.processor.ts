/* eslint-disable prettier/prettier */
import { Processor, Process } from '@nestjs/bull';
import { Job as BullJob } from 'bull';
import { JobService } from './job.service';
import { JobStatus } from './job-status.enum';
import { Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Job } from './job.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Processor('jobQueue')
export class JobProcessor {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(
        @InjectRepository(Job)
        private jobRepository: Repository<Job>,
        private readonly jobService: JobService
    ) {}
  

  @Process('processJob')
  async handleProcessJob(job: BullJob<{ jobId: string }>) {
    const { jobId } = job.data;
    const dbJob = await this.jobRepository.findOne({ where: {id: jobId } });
    if (!dbJob) {
      this.logger.warn(`Job with ID ${jobId} not found in the database`);
      return;
    }

    try {
      this.logger.log(`Processing job with ID: ${jobId}`);
      await this.jobRepository.update(jobId, { status: JobStatus.IN_PROGRESS });

      const twitterUsername = process.env.TWITTER_USERNAME
      const twitterPassword = process.env.TWITTER_PASSWORD

      const results = await this.scrapeTwitter(dbJob.query, twitterUsername, twitterPassword);

      dbJob.status = JobStatus.COMPLETED;
      dbJob.results = results;
      await this.jobRepository.save(dbJob);

      this.logger.log(`Job with ID: ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process job with ID: ${jobId}`, error.message);

      dbJob.status = JobStatus.FAILED;
      dbJob.error = error.message;
      await this.jobRepository.save(dbJob);
    }
  }

  async scrapeTwitter(query, username, password) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
  
      // Navigate to Twitter login page
      await page.goto("https://twitter.com/login", {
        waitUntil: "domcontentloaded",
      });
  
      // Login to Twitter
      await page.waitForSelector('input[name="text"]', { timeout: 10000 });
      await page.type('input[name="text"]', username);
      await page.click("button:nth-of-type(2) > .css-146c3p1");
  
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      await page.type('input[name="password"]', password);
      await page.click(".r-19yznuf > .css-146c3p1");
  
      await page.waitForNavigation();
  
      // Go to Twitter search page
      await page.goto(
        `https://twitter.com/search?q=${encodeURIComponent(query)}&f=live`,
        { waitUntil: "domcontentloaded" }
      );
      await page.waitForSelector("article", { timeout: 30000 });
  
      // Extract tweets
      const tweets = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("article"))
          .slice(0, 10)
          .map((tweet) => ({
            username: tweet.querySelector("span")?.textContent || "",
            content: tweet.querySelector("div[lang]")?.textContent || "",
          }));
      });
  
      return tweets;
    } catch (error) {
      console.error(`Error scraping Twitter: ${error.message}`);
      throw new Error("Failed to scrape Twitter.");
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
}
