import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { onCall, HttpsError } from 'firebase-functions/https';

admin.initializeApp();

// Type definitions
interface ScrapeRequest {
    url: string;
    refinements?: {
        location?: string;
        jobTitle?: string;
    };
}

interface JobData {
    url: string;
    title: string;
    company: string;
    location: string;
    description?: string;
    salary?: string;
    requirements?: string[];
    responsibilities?: string[];
    employmentType?: string;
    postedDate?: string;
}

interface ScrapeResponse {
    type: 'single' | 'list';
    jobs?: JobData[];
    job?: JobData;
    error?: string;
}


export const scrapeJobPage = onCall(
    {
        timeoutSeconds: 60,
        memory: "1GiB",
    },
    async (request): Promise<ScrapeResponse> => {
        const data = request.data as ScrapeRequest;

        if (!data || !data.url) {
            throw new HttpsError("invalid-argument", "URL is required");
        }

        const { url } = data;
        console.log("Scraping URL:", url);

        // Try multiple scraping methods
        let scrapedData = null;

        // Method 1: Direct HTTP request with better headers
        scrapedData = await scrapeWithAxios(url);

        // Method 2: If blocked, try with different user agent
        if (!scrapedData || scrapedData.error) {
            scrapedData = await scrapeWithDifferentHeaders(url);
        }

        // Method 3: Use proxy if still blocked
        if (!scrapedData || scrapedData.error) {
            scrapedData = await scrapeWithProxy(url);
        }

        return scrapedData || { type: 'single', error: 'All scraping methods failed' };
    }
);


async function scrapeWithAxios(url: string): Promise<ScrapeResponse> {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/',
            },
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });

        if (response.status === 403 || response.status === 429) {
            return { type: 'single', error: `Blocked: ${response.status}` };
        }

        const $ = cheerio.load(response.data);
        return extractJobData($, url);

    } catch (error: any) {
        console.error('Axios scraping failed:', error.message);
        return { type: 'single', error: error.message };
    }
}

async function scrapeWithDifferentHeaders(url: string): Promise<ScrapeResponse> {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ];

    for (const ua of userAgents) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': ua },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            return extractJobData($, url);
        } catch (error) {
            continue;
        }
    }

    return { type: 'single', error: 'All user agents blocked' };
}

async function scrapeWithProxy(url: string): Promise<ScrapeResponse> {
    // Use a free proxy API or service
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await axios.get(proxyUrl, { timeout: 20000 });
        const $ = cheerio.load(response.data);
        return extractJobData($, url);
    } catch (error) {
        return { type: 'single', error: 'Proxy scraping failed' };
    }
}

function extractJobData($: cheerio.CheerioAPI, url: string): ScrapeResponse {

      // ✅ ADD THIS SECTION AT THE BEGINNING - Check for specific job sites first
    if (url.includes('indeed.com')) {
        return scrapeIndeed($, url);
    }
    if (url.includes('linkedin.com')) {
        return scrapeLinkedIn($, url);
    }
    if (url.includes('glassdoor.com')) {
        return scrapeGlassdoor($, url);
    }
    if (url.includes('angel.co') || url.includes('wellfound.com')) {
        return scrapeAngelList($, url);
    }
    if (url.includes('greenhouse.io')) {
        return scrapeGreenhouse($, url);
    }
    if (url.includes('lever.co')) {
        return scrapeLever($, url);
    }
    if (url.includes('workday.com')) {
        return scrapeWorkday($, url);
    }
    // Enhanced extraction logic
    const extractText = (selectors: string[]): string => {
        for (const selector of selectors) {
            const text = $(selector).first().text().trim();
            if (text && text.length > 3) return text;
        }
        return '';
    };

    // Try to extract as much data as possible
    const job: JobData = {
        url: url,
        title: extractText([
            'h1', '.jobTitle', '[class*="title"]', '[data-testid*="title"]',
            '.job-title', '.position-title', 'h2.title'
        ]),
        company: extractText([
            '.company', '.employer', '[class*="company"]', '[data-company]',
            '.companyName', '[data-testid*="company"]'
        ]),
        location: extractText([
            '.location', '[class*="location"]', '[data-location]',
            '.locationsContainer', '[data-testid*="location"]'
        ]),
        salary: extractText([
            '.salary', '[class*="salary"]', '[data-salary]',
            '.compensation', '.pay', '[class*="compensation"]'
        ]),
        description: extractText([
            '.description', '.job-description', '[class*="description"]',
            '#jobDescriptionText', '.jobsearch-JobComponent-description',
            'article', '.content', 'main'
        ]).substring(0, 5000),
        employmentType: extractText([
            '.employment-type', '[class*="employment"]', '.job-type',
            '[data-job-type]', '.metadata'
        ])
    };

    // Extract structured data from JSON-LD if available
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
        try {
            const data = JSON.parse(jsonLd);
            if (data['@type'] === 'JobPosting') {
                job.title = job.title || data.title;
                job.company = job.company || data.hiringOrganization?.name;
                job.location = job.location || data.jobLocation?.address?.addressLocality;
                job.salary = job.salary || data.baseSalary?.value?.value;
                job.description = job.description || data.description;
            }
        } catch (e) {
            // Ignore JSON-LD parse errors
        }
    }

    // Check if this is a job list page
    const jobLinks = findJobLinks($, url);
    if (jobLinks.length > 1 && (!job.title || !job.company)) {
        return { type: 'list', jobs: jobLinks };
    }

    return { type: 'single', job };
}

function findJobLinks($: cheerio.CheerioAPI, baseUrl: string): JobData[] {
    const jobs: JobData[] = [];
    const linkSelectors = [
        'a[href*="/jobs/view/"]',
        'a[href*="/viewjob"]',
        '.job-card a',
        '[data-job-id] a',
        '.jobsearch-SerpJobCard a'
    ];

    linkSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
            if (i >= 10) return;

            const $elem = $(elem);
            const href = $elem.attr('href');
            if (href) {
                const fullUrl = href.startsWith('http')
                    ? href
                    : new URL(href, baseUrl).href;

                jobs.push({
                    url: fullUrl,
                    title: $elem.text().trim() || $elem.closest('.job-card').find('.title').text(),
                    company: $elem.closest('.job-card').find('.company').text(),
                    location: $elem.closest('.job-card').find('.location').text()
                });
            }
        });
    });

    return jobs;
}

function scrapeAngelList($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('.styles_title__2NjT8').text().trim() || $('h1').first().text().trim(),
        company: $('.styles_name__3e_c6').text().trim() || $('[data-test="CompanyName"]').text().trim(),
        location: $('.styles_location__1R7mD').text().trim(),
        salary: $('.styles_salary__1xbF7').text().trim(),
        description: $('.styles_description__3lf0V').text().trim() || $('.job-description').text().trim(),
        employmentType: $('.styles_jobType__3K7gZ').text().trim()
    };
    
    return { type: 'single', job };
}

function scrapeGreenhouse($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('#header h1').text().trim() || $('.app-title').text().trim(),
        company: $('.company-name').text().trim() || $('[data-element="company-name"]').text().trim(),
        location: $('.location').text().trim(),
        salary: '',
        description: $('#content').text().trim() || $('.content').text().trim(),
        employmentType: $('.commitment').text().trim()
    };
    
    return { type: 'single', job };
}

function scrapeLever($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('h2').first().text().trim() || $('.posting-headline h2').text().trim(),
        company: $('.posting-categories .company').text().trim(),
        location: $('.location').text().trim() || $('.posting-categories .workplaceTypes').text().trim(),
        salary: '',
        description: $('.posting-description').text().trim() || $('.section-wrapper').text().trim(),
        employmentType: $('.commitment').text().trim()
    };
    
    return { type: 'single', job };
}

function scrapeWorkday($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('[data-automation-id="jobPostingHeader"]').text().trim(),
        company: $('[data-automation-id="company"]').text().trim(),
        location: $('[data-automation-id="locationText"]').text().trim(),
        salary: $('[data-automation-id="salary"]').text().trim(),
        description: $('[data-automation-id="jobPostingDescription"]').text().trim(),
        employmentType: $('[data-automation-id="jobType"]').text().trim()
    };
    
    return { type: 'single', job };
}


// Add these functions if they're missing:

function scrapeIndeed($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    if (url.includes('-jobs.html') || url.includes('/jobs?')) {
        const jobs: JobData[] = [];
        
        $('.jobsearch-ResultsList .result, .jobsearch-SerpJobCard, [data-jk]').each((i, elem) => {
            if (i >= 15) return;
            
            const $elem = $(elem);
            const jobId = $elem.attr('data-jk');
            const jobLink = $elem.find('.jobTitle a, h2 a').attr('href');
            const fullUrl = jobLink?.startsWith('http') 
                ? jobLink 
                : `https://www.indeed.com${jobLink || `/viewjob?jk=${jobId}`}`;
            
            const job: JobData = {
                url: fullUrl,
                title: $elem.find('.jobTitle span[title]').text().trim(),
                company: $elem.find('.companyName').text().trim(),
                location: $elem.find('.locationsContainer').text().trim(),
                salary: $elem.find('.salary-snippet').text().trim()
            };
            
            if (job.title && job.company) {
                jobs.push(job);
            }
        });
        
        return { type: 'list', jobs };
    }
    
    return scrapeIndeedJob($, url);
}

function scrapeIndeedJob($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('.jobsearch-JobInfoHeader-title, h1').first().text().trim(),
        company: $('.jobsearch-CompanyInfoWithoutHeaderImage .companyName').text().trim(),
        location: $('.jobsearch-JobInfoHeader-subtitle > div:last-child').text().trim(),
        salary: $('.jobsearch-JobMetadataHeader-item .attribute_snippet').text().trim(),
        employmentType: $('.jobsearch-JobMetadataHeader-item').text().trim(),
        description: $('#jobDescriptionText').text().trim()
    };
    
    return { type: 'single', job };
}

function scrapeLinkedIn($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    if (url.includes('/jobs/search') || url.includes('/jobs/collections')) {
        const jobs: JobData[] = [];
        
        $('.jobs-search__results-list li').each((i, elem) => {
            if (i >= 15) return;
            
            const $elem = $(elem);
            const jobLink = $elem.find('a').first().attr('href');
            
            const job: JobData = {
                url: jobLink?.startsWith('http') ? jobLink : `https://www.linkedin.com${jobLink}`,
                title: $elem.find('.job-card-list__title').text().trim(),
                company: $elem.find('.job-card-container__company-name').text().trim(),
                location: $elem.find('.job-card-container__metadata-item').first().text().trim()
            };
            
            if (job.title && job.url) {
                jobs.push(job);
            }
        });
        
        return { type: 'list', jobs };
    }
    
    return scrapeLinkedInJob($, url);
}

function scrapeLinkedInJob($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    const job: JobData = {
        url: url,
        title: $('.top-card-layout__title, h1').first().text().trim(),
        company: $('.topcard__org-name-link').text().trim(),
        location: $('.topcard__flavor--bullet').first().text().trim(),
        employmentType: $('.jobs-unified-top-card__workplace-type').text().trim(),
        description: $('.description__text, .show-more-less-html__markup').text().trim()
    };
    
    return { type: 'single', job };
}

function scrapeGlassdoor($: cheerio.CheerioAPI, url: string): ScrapeResponse {
    if (url.includes('/Job/jobs')) {
        const jobs: JobData[] = [];
        
        $('[data-test="job-link"]').each((i, elem) => {
            if (i >= 15) return;
            
            const $elem = $(elem);
            const jobLink = $elem.attr('href');
            
            const job: JobData = {
                url: jobLink?.startsWith('http') ? jobLink : `https://www.glassdoor.com${jobLink}`,
                title: $elem.find('.job-title').text().trim(),
                company: $elem.find('[data-test="employer-name"]').text().trim(),
                location: $elem.find('[data-test="employer-location"]').text().trim()
            };
            
            if (job.title && job.url) {
                jobs.push(job);
            }
        });
        
        return { type: 'list', jobs };
    }
    
    const job: JobData = {
        url: url,
        title: $('[data-test="job-title"], h1').first().text().trim(),
        company: $('[data-test="employer-name"]').text().trim(),
        location: $('[data-test="location"]').text().trim(),
        salary: $('.salary-estimate').text().trim(),
        description: $('.desc, .jobDescriptionContent').text().trim()
    };
    
    return { type: 'single', job };
}