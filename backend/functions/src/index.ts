import * as admin from 'firebase-admin';
import {  Browser, Page } from 'playwright-chromium';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

admin.initializeApp();

// Interfaces
interface JobData {
    url: string;
    title: string;
    company: string;
    location: string;
    description: string;
    salary?: string;
    postedDate?: string;
    requirements?: string[];
    responsibilities?: string[];
    employmentType?: string;
    workplaceType?: string;
}

interface ScrapeRequest {
    url: string;
    type?: 'single' | 'list';
}

interface ScrapeResponse {
    type: 'single' | 'multiple';
    jobs: JobData[];
    error?: string;
}

export const scrapeJobsWithPlaywright = onCall(
    {
        timeoutSeconds: 120,
        memory: "2GiB",
    },
    async (request): Promise<ScrapeResponse> => {
        const data = request.data as ScrapeRequest;

        if (!data || !data.url) {
            throw new HttpsError("invalid-argument", "URL is required");
        }

        const { url } = data;
        console.log("Scraping URL with Playwright:", url);

        let browser: Browser | null = null;
        let page: Page | null = null;

        try {
            // Launch Playwright with optimized settings
            browser = await playwrightChromium.launch({
                args: chromium.args,
                executablePath: await chromium.executablePath(),
                headless: true, // usually true
            });

            page = await browser.newPage({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            // Set viewport and extra headers
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9'
            });

            // Navigate to the URL
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Wait a bit for dynamic content
            await page.waitForTimeout(2000);

            // Determine the site and scrape accordingly
            let jobs: JobData[] = [];

            if (url.includes('linkedin.com')) {
                jobs = await scrapeLinkedInJobs(page, url);
            } else if (url.includes('indeed.com')) {
                jobs = await scrapeIndeedJobs(page, url);
            } else if (url.includes('glassdoor.com')) {
                jobs = await scrapeGlassdoorJobs(page, url);
            } else {
                // Generic scraping for other sites
                jobs = await scrapeGenericJobs(page, url);
            }

            console.log(`Scraped ${jobs.length} jobs from ${url}`);

            return {
                type: jobs.length > 1 ? 'multiple' : 'single',
                jobs: jobs
            };

        } catch (error: any) {
            console.error("Playwright scraping error:", error);
            return {
                type: 'single',
                jobs: [],
                error: error.message
            };
        } finally {
            if (page) await page.close();
            if (browser) await browser.close();
        }
    }
);

// Scrape LinkedIn jobs (handles both single and multiple jobs)
async function scrapeLinkedInJobs(page: Page, url: string): Promise<JobData[]> {
    const jobs: JobData[] = [];

    try {
        // Check if it's a job search page with multiple jobs
        const isSearchPage = url.includes('/jobs/search') || url.includes('/jobs/collections');

        if (isSearchPage) {
            console.log('LinkedIn search page detected - extracting multiple jobs');

            // Wait for job cards to load
            await page.waitForSelector('.jobs-search__results-list li', { timeout: 5000 }).catch(() => { });

            // Scroll to load more jobs
            await autoScroll(page);

            // Extract all job links
            const jobCards = await page.$$eval('.jobs-search__results-list li', (cards) => {
                return cards.slice(0, 25).map(card => {
                    const linkElement = card.querySelector('a');
                    const titleElement = card.querySelector('.base-search-card__title');
                    const companyElement = card.querySelector('.base-search-card__subtitle a');
                    const locationElement = card.querySelector('.job-search-card__location');
                    const timeElement = card.querySelector('time');

                    return {
                        url: linkElement?.href || '',
                        title: titleElement?.textContent?.trim() || '',
                        company: companyElement?.textContent?.trim() || '',
                        location: locationElement?.textContent?.trim() || '',
                        postedDate: timeElement?.getAttribute('datetime') || timeElement?.textContent?.trim() || ''
                    };
                });
            });

            // Visit each job page to get full details
            for (const jobCard of jobCards.slice(0, 20)) { // Limit to 20 jobs
                if (jobCard.url && isRecentJob(jobCard.postedDate)) {
                    try {
                        console.log(`Fetching details for: ${jobCard.title}`);

                        // Navigate to job page
                        await page.goto(jobCard.url, {
                            waitUntil: 'domcontentloaded',
                            timeout: 15000
                        });
                        await page.waitForTimeout(1500);

                        // Extract full job details
                        const jobDetails = await page.evaluate(() => {
                            const title = document.querySelector('.top-card-layout__title, h1')?.textContent?.trim() || '';
                            const company = document.querySelector('.topcard__org-name-link, .top-card-layout__company')?.textContent?.trim() || '';
                            const location = document.querySelector('.topcard__flavor--bullet, .top-card-layout__location')?.textContent?.trim() || '';

                            // Get full description
                            let description = '';
                            const descElement = document.querySelector('.description__text, .show-more-less-html__markup, .jobs-description');
                            if (descElement) {
                                description = descElement.textContent?.trim() || '';
                            }

                            // Extract employment type
                            const employmentType = document.querySelector('.description__job-criteria-text')?.textContent?.trim() || '';

                            // Extract salary if available
                            const salaryElement = document.querySelector('.salary, .compensation__salary');
                            const salary = salaryElement?.textContent?.trim() || '';

                            return {
                                title,
                                company,
                                location,
                                description,
                                employmentType,
                                salary
                            };
                        });

                        if (jobDetails.title && jobDetails.description) {
                            jobs.push({
                                url: jobCard.url,
                                ...jobDetails,
                                postedDate: jobCard.postedDate,
                                requirements: extractRequirements(jobDetails.description),
                                responsibilities: extractResponsibilities(jobDetails.description)
                            });
                        }

                    } catch (err) {
                        console.error(`Failed to scrape job details for ${jobCard.url}:`, err);
                    }
                }
            }

        } else {
            // Single job page
            console.log('LinkedIn single job page detected');

            const job = await page.evaluate(() => {
                const title = document.querySelector('.top-card-layout__title, h1')?.textContent?.trim() || '';
                const company = document.querySelector('.topcard__org-name-link')?.textContent?.trim() || '';
                const location = document.querySelector('.topcard__flavor--bullet')?.textContent?.trim() || '';
                const description = document.querySelector('.description__text, .show-more-less-html__markup')?.textContent?.trim() || '';
                const employmentType = document.querySelector('.description__job-criteria-text')?.textContent?.trim() || '';
                const salary = document.querySelector('.salary')?.textContent?.trim() || '';
                const postedDate = document.querySelector('time')?.textContent?.trim() || '';

                return {
                    title,
                    company,
                    location,
                    description,
                    employmentType,
                    salary,
                    postedDate
                };
            });

            if (job.title && isRecentJob(job.postedDate)) {
                jobs.push({
                    url,
                    ...job,
                    requirements: extractRequirements(job.description),
                    responsibilities: extractResponsibilities(job.description)
                });
            }
        }

    } catch (error) {
        console.error('LinkedIn scraping error:', error);
    }

    return jobs;
}

// Scrape Indeed jobs
async function scrapeIndeedJobs(page: Page, url: string): Promise<JobData[]> {
    const jobs: JobData[] = [];

    try {
        const isSearchPage = url.includes('-jobs.html') || url.includes('/jobs?');

        if (isSearchPage) {
            console.log('Indeed search page detected - extracting multiple jobs');

            await page.waitForSelector('.jobsearch-ResultsList', { timeout: 5000 }).catch(() => { });
            await autoScroll(page);

            // Get all job cards
            const jobCards = await page.$$eval('[data-jk]', (cards) => {
                return cards.slice(0, 25).map(card => {
                    const titleElement = card.querySelector('.jobTitle span[title]');
                    const companyElement = card.querySelector('.companyName');
                    const locationElement = card.querySelector('.companyLocation');
                    const dateElement = card.querySelector('.date');
                    const linkElement = card.querySelector('.jobTitle a');
                    const jobKey = card.getAttribute('data-jk');

                    return {
                        jobKey,
                        url: linkElement?.baseURI || `https://www.indeed.com/viewjob?jk=${jobKey}`,
                        title: titleElement?.textContent?.trim() || '',
                        company: companyElement?.textContent?.trim() || '',
                        location: locationElement?.textContent?.trim() || '',
                        postedDate: dateElement?.textContent?.trim() || ''
                    };
                });
            });

            // Get full details for each job
            for (const jobCard of jobCards.slice(0, 20)) {
                if (jobCard.url && isRecentJob(jobCard.postedDate)) {
                    try {
                        await page.goto(jobCard.url, {
                            waitUntil: 'domcontentloaded',
                            timeout: 15000
                        });
                        await page.waitForTimeout(1500);

                        const jobDetails = await page.evaluate(() => {
                            const title = document.querySelector('.jobsearch-JobInfoHeader-title span')?.textContent?.trim() || '';
                            const company = document.querySelector('[data-company-name="true"]')?.textContent?.trim() || '';
                            const location = document.querySelector('[data-testid="job-location"]')?.textContent?.trim() || '';
                            const salary = document.querySelector('[data-testid="job-salary"]')?.textContent?.trim() || '';
                            const description = document.querySelector('#jobDescriptionText')?.textContent?.trim() || '';
                            const employmentType = document.querySelector('.jobsearch-JobMetadataHeader-item')?.textContent?.trim() || '';

                            return {
                                title,
                                company,
                                location,
                                salary,
                                description,
                                employmentType
                            };
                        });

                        if (jobDetails.title && jobDetails.description) {
                            jobs.push({
                                url: jobCard.url,
                                ...jobDetails,
                                postedDate: jobCard.postedDate,
                                requirements: extractRequirements(jobDetails.description),
                                responsibilities: extractResponsibilities(jobDetails.description)
                            });
                        }

                    } catch (err) {
                        console.error(`Failed to scrape Indeed job: ${err}`);
                    }
                }
            }

        } else {
            // Single job page
            const job = await page.evaluate(() => {
                const title = document.querySelector('.jobsearch-JobInfoHeader-title span')?.textContent?.trim() || '';
                const company = document.querySelector('[data-company-name="true"]')?.textContent?.trim() || '';
                const location = document.querySelector('[data-testid="job-location"]')?.textContent?.trim() || '';
                const salary = document.querySelector('[data-testid="job-salary"]')?.textContent?.trim() || '';
                const description = document.querySelector('#jobDescriptionText')?.textContent?.trim() || '';
                const employmentType = document.querySelector('.jobsearch-JobMetadataHeader-item')?.textContent?.trim() || '';
                const postedDate = document.querySelector('.jobsearch-JobInfoHeader-underTitle .date')?.textContent?.trim() || '';

                return {
                    title,
                    company,
                    location,
                    salary,
                    description,
                    employmentType,
                    postedDate
                };
            });

            if (job.title && isRecentJob(job.postedDate)) {
                jobs.push({
                    url,
                    ...job,
                    requirements: extractRequirements(job.description),
                    responsibilities: extractResponsibilities(job.description)
                });
            }
        }

    } catch (error) {
        console.error('Indeed scraping error:', error);
    }

    return jobs;
}

// Similar functions for Glassdoor and generic sites
async function scrapeGlassdoorJobs(page: Page, url: string): Promise<JobData[]> {
    // Similar implementation for Glassdoor
    const jobs: JobData[] = [];
    // ... implement Glassdoor scraping
    return jobs;
}

async function scrapeGenericJobs(page: Page, url: string): Promise<JobData[]> {
    // Generic job scraping
    const jobs: JobData[] = [];

    try {
        const job = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            const description = document.querySelector('main, article, .content')?.textContent?.trim() || '';

            return {
                title,
                description,
                company: '',
                location: ''
            };
        });

        if (job.title && job.description) {
            jobs.push({
                url,
                ...job,
                requirements: extractRequirements(job.description),
                responsibilities: extractResponsibilities(job.description)
            });
        }
    } catch (error) {
        console.error('Generic scraping error:', error);
    }

    return jobs;
}

// Helper function to auto-scroll page
async function autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

// Check if job is recent (within 4 days)
function isRecentJob(dateStr: string): boolean {
    if (!dateStr) return true; // If no date, include it

    const lower = dateStr.toLowerCase();

    // Check for fresh indicators
    if (lower.includes('just posted') ||
        lower.includes('today') ||
        lower.includes('1 day') ||
        lower.includes('2 days') ||
        lower.includes('3 days') ||
        lower.includes('4 days')) {
        return true;
    }

    // Reject old jobs
    if (lower.includes('week') ||
        lower.includes('month') ||
        lower.includes('30+ days')) {
        return false;
    }

    // Check for number of days
    const match = lower.match(/(\d+)\s*days?/);
    if (match) {
        const days = parseInt(match[1]);
        return days <= 4;
    }

    return true; // Default to include
}

// Extract requirements from description
function extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    const lines = description.split(/\n|\.|\•|\-/);

    let inRequirements = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('requirement') || lower.includes('qualification') || lower.includes('must have')) {
            inRequirements = true;
            continue;
        }

        if (inRequirements && line.trim().length > 10) {
            requirements.push(line.trim());
            if (requirements.length >= 5) break;
        }

        if (inRequirements && (lower.includes('responsibilit') || lower.includes('benefit'))) {
            break;
        }
    }

    return requirements.slice(0, 5);
}

// Extract responsibilities from description  
function extractResponsibilities(description: string): string[] {
    const responsibilities: string[] = [];
    const lines = description.split(/\n|\.|\•|\-/);

    let inResponsibilities = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('responsibilit') || lower.includes('duties') || lower.includes('you will')) {
            inResponsibilities = true;
            continue;
        }

        if (inResponsibilities && line.trim().length > 10) {
            responsibilities.push(line.trim());
            if (responsibilities.length >= 5) break;
        }

        if (inResponsibilities && (lower.includes('requirement') || lower.includes('benefit'))) {
            break;
        }
    }

    return responsibilities.slice(0, 5);
}