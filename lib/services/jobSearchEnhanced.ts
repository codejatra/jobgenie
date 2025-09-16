import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { JobListing } from './jobService';
import { StoredResume } from './resumeService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
// Create reference to your cloud function
const scrapeJobPageFunction = httpsCallable(functions, 'scrapeJobPage');

export interface SearchRefinements {
    jobTitles: string[];
    synonyms: string[];
    location: {
        city?: string;
        radius?: number;
        remote?: boolean;
        hybrid?: boolean;
        timezone?: string;
    };
    seniority: string;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    salary: {
        min?: number;
        max?: number;
        currency?: string;
        type?: 'hourly' | 'yearly';
    };
    contractType: string;
    eligibility: {
        visa?: string;
        relocation?: boolean;
        languages?: string[];
    };
    dateRange: number; // days
    exclusions: {
        companies?: string[];
        keywords?: string[];
        agencies?: boolean;
    };
    targetCompanies?: string[];
}

export interface EnhancedJobListing extends JobListing {
    matchScore: number;
    matchReasons: string[];
    missingSkills: string[];
    interviewQuestions?: Array<{ type: string; question: string }>; // Fixed type
    salaryNegotiation?: {
        strategy: string;
        talkingPoints: string[];
        expectedRange: string;
    };
}

// Add at the top with other interfaces
interface JobSignature {
    title: string;
    company: string;
    location: string;
}


// Analyze prompt or resume for missing information
// Fix analyzeSearchIntent to properly detect missing info
export async function analyzeSearchIntent(
    input: string,
    isResume: boolean = false
): Promise<{
    refinements: SearchRefinements;
    missingInfo: string[];
    suggestions: string[];
}> {
    try {
        // Check for basic required information
        const hasLocation = /\b(remote|hybrid|onsite|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/.test(input);
        const hasJobTitle = input.split(' ').length > 1;
        const hasSalary = /\$|\d+k/i.test(input);
        
        // Determine what's missing
        const missingInfo: string[] = [];
        if (!hasJobTitle) missingInfo.push('Specific job title or role');
        if (!hasLocation) missingInfo.push('Location preference (city or remote)');
        if (!hasSalary) missingInfo.push('Salary expectations (optional)');
        
        // If critical info is missing, return with missingInfo
        if (missingInfo.length > 0 && !isResume) {
            return {
                refinements: {
                    jobTitles: [],
                    synonyms: [],
                    location: {},
                    seniority: 'mid',
                    mustHaveSkills: [],
                    niceToHaveSkills: [],
                    salary: {},
                    contractType: 'full-time',
                    eligibility: { languages: ['English'] },
                    dateRange: 3,
                    exclusions: {},
                    targetCompanies: []
                },
                missingInfo,
                suggestions: [
                    'Add specific job title (e.g., "Senior React Developer")',
                    'Include location or mention if remote is okay',
                    'Specify experience level (junior/mid/senior)'
                ]
            };
        }
        
        // Try to extract with Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const prompt = `
        Extract search parameters from: "${input}"
        
        Return JSON:
        {
            "refinements": {
                "jobTitles": ["extracted titles"],
                "location": {"city": "extracted city or Remote"},
                "seniority": "junior/mid/senior",
                "mustHaveSkills": ["skill1", "skill2"],
                "salary": {"min": 0, "max": 0},
                "contractType": "full-time",
                "dateRange": 3
            },
            "missingInfo": ["what's missing"],
            "suggestions": ["helpful suggestions"]
        }
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const parsed = safeJsonParse(text);
        
        // Ensure missingInfo is populated if key data is missing
        if (parsed && parsed.refinements) {
            if (!parsed.refinements.jobTitles?.length) {
                parsed.missingInfo = parsed.missingInfo || [];
                parsed.missingInfo.push('Specific job title');
            }
            if (!parsed.refinements.location?.city) {
                parsed.missingInfo = parsed.missingInfo || [];
                parsed.missingInfo.push('Location preference');
            }
            return parsed;
        }
        
        // Fallback with missingInfo
        return {
            refinements: {
                jobTitles: [],
                synonyms: [],
                location: { remote: true },
                seniority: 'mid',
                mustHaveSkills: [],
                niceToHaveSkills: [],
                salary: {},
                contractType: 'full-time',
                eligibility: { languages: ['English'] },
                dateRange: 3,
                exclusions: {},
                targetCompanies: []
            },
            missingInfo: ['Job title', 'Location preference'],
            suggestions: ['Be specific about the role', 'Add your preferred location']
        };
        
    } catch (error) {
        console.error('Intent analysis error:', error);
        
        // Always return with missingInfo to trigger refinement popup
        return {
            refinements: {
                jobTitles: [],
                synonyms: [],
                location: { remote: true },
                seniority: 'mid',
                mustHaveSkills: [],
                niceToHaveSkills: [],
                salary: {},
                contractType: 'full-time',
                eligibility: { languages: ['English'] },
                dateRange: 3,
                exclusions: {},
                targetCompanies: []
            },
            missingInfo: ['Job title', 'Location preference', 'Experience level'],
            suggestions: ['Add specific job title', 'Specify location or remote', 'Include experience level']
        };
    }
}

// Build optimized search query
function buildSearchQuery(refinements: SearchRefinements): string {
    const parts = [];

    if (refinements.jobTitles.length > 0) {
        const titles = [...refinements.jobTitles, ...refinements.synonyms];
        parts.push(`(${titles.join(' OR ')})`);
    }

    if (refinements.location.city) {
        parts.push(refinements.location.city);
    }
    if (refinements.location.remote) {
        parts.push('remote');
    }

    if (refinements.seniority && refinements.seniority !== 'mid') {
        parts.push(refinements.seniority);
    }

    if (refinements.mustHaveSkills.length > 0) {
        parts.push(refinements.mustHaveSkills.slice(0, 3).join(' '));
    }

    // Add fresh job indicators
    parts.push('hiring now');
    parts.push('actively hiring');
    parts.push('"posted today" OR "posted yesterday" OR "posted 2 days ago"');

    return parts.join(' ');
}


// Update processJobResult to handle the cloud function response:



// Helper functions
function isJobUrl(url: string): boolean {
    const jobIndicators = [
        'linkedin.com/jobs',
        'indeed.com',
        'glassdoor.com',
        'careers',
        'jobs',
        'apply',
        'workday.com',
        'greenhouse.io',
        'lever.co'
    ];
    return jobIndicators.some(indicator => url.toLowerCase().includes(indicator));
}

function getDaysAgo(dateString: string): number {
    try {
        // Handle relative dates
        if (dateString.includes('hour') || dateString.includes('minute')) return 0;
        if (dateString.includes('yesterday')) return 1;
        if (dateString.includes('2 days ago')) return 2;
        if (dateString.includes('3 days ago')) return 3;

        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
        return 0;
    }
}

function extractCompanyFromTitle(title: string): string {
    const parts = title.split(' at ');
    if (parts.length > 1) {
        return parts[1].split(' - ')[0].split(' | ')[0].trim();
    }
    const dashParts = title.split(' - ');
    if (dashParts.length > 1) {
        return dashParts[dashParts.length - 1].trim();
    }
    return '';
}

function expandDescription(snippet: string): string {
    return `${snippet}

This is an exciting opportunity to join a dynamic team and make a significant impact. The role involves working with cutting-edge technologies and collaborating with talented professionals. 

You will be responsible for delivering high-quality solutions, participating in the full development lifecycle, and contributing to the team's success. This position offers excellent growth opportunities and the chance to work on challenging projects.

The ideal candidate will have strong technical skills, excellent communication abilities, and a passion for innovation. We offer a competitive compensation package, comprehensive benefits, and a supportive work environment that promotes professional development and work-life balance.`;
}

function generateDefaultRequirements(title: string): string[] {
    const issSenior = title.toLowerCase().includes('senior');
    const years = issSenior ? '5+' : '3+';

    return [
        `${years} years of relevant professional experience`,
        'Strong problem-solving and analytical skills',
        'Excellent written and verbal communication skills',
        'Bachelor\'s degree in Computer Science or related field (or equivalent experience)',
        'Experience with modern development practices and tools'
    ];
}

function generateDefaultResponsibilities(title: string): string[] {
    return [
        'Design, develop, and maintain high-quality software applications',
        'Collaborate with cross-functional teams to deliver projects',
        'Participate in code reviews and maintain code quality standards',
        'Troubleshoot and debug applications to optimize performance',
        'Stay current with industry trends and emerging technologies'
    ];
}


// Generate interview questions (Fixed to return string array)
export async function generateInterviewQuestions(job: JobListing): Promise<string[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
    Generate 10 interview questions for:
    ${job.title} at ${job.company}
    
    Return ONLY a JSON array of question strings:
    ["question1", "question2", ...]
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = safeJsonParse(text);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        // Fallback questions
        return [
            'Tell me about yourself and your experience',
            'Why are you interested in this role?',
            'What are your key strengths?',
            'Describe a challenging project you worked on',
            'How do you handle tight deadlines?',
            'Where do you see yourself in 5 years?',
            'Why do you want to work for our company?',
            'How do you stay updated with industry trends?',
            'Describe your ideal work environment',
            'Do you have any questions for us?'
        ];
    } catch (error) {
        console.error('Interview questions generation error:', error);
        return [
            'Tell me about yourself',
            'Why are you interested in this position?',
            'What are your greatest strengths?',
            'What is your biggest weakness?',
            'Where do you see yourself in 5 years?'
        ];
    }
}

// Get company details (Fixed JSON parsing)
export async function getCompanyDetails(companyName: string): Promise<{
    overview: string;
    culture: string;
    benefits: string[];
    interviewProcess: string;
    growthOpportunities: string;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
    Provide information about ${companyName}.
    
    Return ONLY valid JSON:
    {
      "overview": "company overview",
      "culture": "culture description",
      "benefits": ["benefit1", "benefit2"],
      "interviewProcess": "process",
      "growthOpportunities": "opportunities"
    }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = safeJsonParse(text);

        if (parsed) {
            return parsed;
        }

        // Fallback
        return {
            overview: `${companyName} is a leading company in its industry, known for innovation and excellence.`,
            culture: 'Collaborative and innovative work environment that values diversity and inclusion.',
            benefits: [
                'Competitive salary and bonuses',
                'Health, dental, and vision insurance',
                'Retirement savings plan with company match',
                'Flexible work arrangements',
                'Professional development opportunities'
            ],
            interviewProcess: 'The typical process includes an initial phone screen, technical assessment, team interviews, and final discussion with leadership.',
            growthOpportunities: 'Clear career progression paths with opportunities for advancement, mentorship programs, and continuous learning initiatives.'
        };
    } catch (error) {
        console.error('Company details error:', error);
        return {
            overview: 'A leading company in the industry.',
            culture: 'Collaborative work environment.',
            benefits: ['Competitive compensation', 'Health benefits', 'Growth opportunities'],
            interviewProcess: 'Standard interview process.',
            growthOpportunities: 'Career advancement opportunities.'
        };
    }
}

// Generate salary negotiation
export async function generateSalaryNegotiation(
    job: JobListing,
    resumeText?: string
): Promise<{
    strategy: string;
    talkingPoints: string[];
    expectedRange: string;
}> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
    Create salary negotiation strategy for ${job.title} at ${job.company}.
    Location: ${job.location}
    Current salary: ${job.salary || 'Not specified'}
    
    Return ONLY valid JSON:
    {
      "strategy": "negotiation strategy",
      "talkingPoints": ["point1", "point2"],
      "expectedRange": "$X - $Y"
    }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = safeJsonParse(text);

        if (parsed) {
            return parsed;
        }

        return {
            strategy: 'Research market rates, highlight your unique value, be prepared to negotiate the entire compensation package.',
            talkingPoints: [
                'Your specific experience matching their requirements',
                'Market rate data for similar positions',
                'Your track record of achievements',
                'Additional value you bring to the role',
                'Flexibility on benefits if salary is fixed'
            ],
            expectedRange: '$90,000 - $130,000'
        };
    } catch (error) {
        console.error('Salary negotiation error:', error);
        return {
            strategy: 'Be prepared with market research and highlight your value.',
            talkingPoints: ['Experience', 'Skills', 'Market rate', 'Value proposition'],
            expectedRange: 'Competitive market rate'
        };
    }
}

// Search jobs from resume
// Fix searchJobsFromResume to work properly
export async function searchJobsFromResume(
    resume: StoredResume,
    additionalFilters?: Partial<SearchRefinements>
): Promise<EnhancedJobListing[]> {
    try {
        if (!resume.extractedText) {
            console.error('No resume text available');
            return [];
        }

        // Extract key information from resume
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
        Extract job search parameters from this resume:
        ${resume.extractedText.substring(0, 2000)}
        
        Return a simple search query (not JSON), like:
        "Software Engineer San Francisco React Node.js"
        
        Include: job title, skills, and preferred location if mentioned.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const searchQuery = response.text().trim();

        console.log('Resume search query:', searchQuery);

        // Analyze for refinements
        const { refinements } = await analyzeSearchIntent(searchQuery, false);
        const finalRefinements = { ...refinements, ...additionalFilters };

        // Search with the extracted query
        return await searchWithRefinements(searchQuery, finalRefinements);

    } catch (error) {
        console.error('Resume search error:', error);
        return [];
    }
}

// Rank jobs for resume
async function rankJobsForResume(
    jobs: JobListing[],
    resumeText: string,
    refinements: SearchRefinements
): Promise<EnhancedJobListing[]> {
    const rankedJobs: EnhancedJobListing[] = [];

    for (const job of jobs) {
        const matchScore = calculateMatchScore(job, refinements);
        const matchReasons = generateMatchReasons(job, refinements);

        rankedJobs.push({
            ...job,
            matchScore,
            matchReasons,
            missingSkills: []
        });
    }

    return rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
}

function calculateMatchScore(job: JobListing, refinements: SearchRefinements): number {
    let score = 70; // Base score

    // Location match
    if (refinements.location.city && job.location.includes(refinements.location.city)) {
        score += 10;
    }
    if (refinements.location.remote && job.workplaceType === 'Remote') {
        score += 10;
    }

    // Salary match
    if (job.salary && refinements.salary.min) {
        const jobSalary = parseInt(job.salary.replace(/\D/g, ''));
        if (jobSalary >= refinements.salary.min) {
            score += 5;
        }
    }

    // Skills match
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    refinements.mustHaveSkills.forEach(skill => {
        if (jobText.includes(skill.toLowerCase())) {
            score += 2;
        }
    });

    return Math.min(score, 95);
}

function generateMatchReasons(job: JobListing, refinements: SearchRefinements): string[] {
    const reasons = [];

    if (refinements.location.city && job.location.includes(refinements.location.city)) {
        reasons.push('Location match');
    }
    if (refinements.location.remote && job.workplaceType === 'Remote') {
        reasons.push('Remote opportunity');
    }
    if (job.salary) {
        reasons.push('Competitive salary');
    }

    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const matchedSkills = refinements.mustHaveSkills.filter(skill =>
        jobText.includes(skill.toLowerCase())
    );

    if (matchedSkills.length > 0) {
        reasons.push(`Matches ${matchedSkills.length} key skills`);
    }

    return reasons.slice(0, 3);
}

// Export simplified search function
export async function performEnhancedSearch(
    searchText: string,
    refinements?: Partial<SearchRefinements>
): Promise<EnhancedJobListing[]> {
    const fullRefinements: SearchRefinements = {
        jobTitles: refinements?.jobTitles || [],
        synonyms: refinements?.synonyms || [],
        location: refinements?.location || { remote: true },
        seniority: refinements?.seniority || 'mid',
        mustHaveSkills: refinements?.mustHaveSkills || [],
        niceToHaveSkills: refinements?.niceToHaveSkills || [],
        salary: refinements?.salary || {},
        contractType: refinements?.contractType || 'full-time',
        eligibility: refinements?.eligibility || { languages: ['English'] },
        dateRange: refinements?.dateRange || 3,
        exclusions: refinements?.exclusions || {},
        targetCompanies: refinements?.targetCompanies || []
    };

    const query = searchText + ' ' + buildSearchQuery(fullRefinements);
    return await searchWithRefinements(query, fullRefinements);
}

// Replace the fetchJobPageContent function with this:
async function fetchJobPageContent(url: string): Promise<any> {
    try {
        console.log('Calling cloud function for:', url);
        const result = await scrapeJobPageFunction({ url });
        console.log('Cloud function response:', result.data);
        return result.data;
    } catch (error) {
        console.error('Cloud function error:', error);
        return null;
    }
}


// Add this helper function for fallback:
async function createJobFromSnippet(
    result: any,
    refinements: SearchRefinements
): Promise<EnhancedJobListing | null> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
    Create a job listing from this search result:
    Title: ${result.title}
    Snippet: ${result.snippet}
    Link: ${result.link}
    
    Generate a complete job listing with description, requirements, etc.
    Return ONLY valid JSON.
    `;

        const geminiResult = await model.generateContent(prompt);
        const response = await geminiResult.response;
        const text = response.text();

        const jobData = safeJsonParse(text);

        if (jobData) {
            return {
                id: generateJobId(result.link),
                ...jobData,
                sourceUrl: result.link,
                postedDate: new Date(),
                matchScore: 70,
                matchReasons: ['Relevant opportunity'],
                missingSkills: []
            };
        }

        return null;
    } catch (error) {
        console.error('Fallback job creation error:', error);
        return null;
    }
}

// Update searchWithRefinements to handle multiple jobs per result:
// Update searchWithRefinements to search multiple sites




// CRITICAL: This version returns proper fallback for refinement
function safeJsonParse(text: string): any {
    if (!text) return null;

    try {
        // Clean the text
        let cleaned = text
            .replace(/```(?:json)?\s*/gi, '')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '')
            .replace(/\t/g, ' ')
            .trim();

        // Find JSON structure
        const jsonMatch = cleaned.match(/\{.*\}/) || cleaned.match(/\[.*\]/);
        if (!jsonMatch) {
            // For refinement analysis, return default structure
            if (text.includes('refinements')) {
                return {
                    refinements: {
                        jobTitles: [],
                        synonyms: [],
                        location: { remote: true },
                        seniority: 'mid',
                        mustHaveSkills: [],
                        niceToHaveSkills: [],
                        salary: {},
                        contractType: 'full-time',
                        eligibility: { languages: ['English'] },
                        dateRange: 3,
                        exclusions: {},
                        targetCompanies: []
                    },
                    missingInfo: ['Job title or role', 'Location preference'],
                    suggestions: ['Add specific job title', 'Specify location']
                };
            }
            return null;
        }

        let jsonStr = jsonMatch[0];

        // Fix common issues
        jsonStr = jsonStr
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ':"$1"')
            .replace(/,\s*([}\]])/g, '$1')
            .replace(/:\s*undefined/g, ':null');

        return JSON.parse(jsonStr);
    } catch (e) {
        // Special handling for refinement responses
        if (text.includes('refinements') || text.includes('missingInfo')) {
            console.log('Refinement parse failed, using defaults');
            return {
                refinements: {
                    jobTitles: [],
                    synonyms: [],
                    location: { remote: true },
                    seniority: 'mid',
                    mustHaveSkills: [],
                    niceToHaveSkills: [],
                    salary: {},
                    contractType: 'full-time',
                    eligibility: { languages: ['English'] },
                    dateRange: 3,
                    exclusions: {},
                    targetCompanies: []
                },
                missingInfo: ['Job title', 'Location', 'Experience level'],
                suggestions: ['Specify the role you want', 'Add your preferred location']
            };
        }
        return null;
    }
}

// Improved structureJobWithGemini with better prompting
async function structureJobWithGemini(
    scrapedData: any,
    url: string,
    refinements: SearchRefinements
): Promise<EnhancedJobListing | null> {
    try {
        // If we have no real data, don't process
        if (!scrapedData || (!scrapedData.title && !scrapedData.description)) {
            console.log('No valid scraped data for:', url);
            return null;
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Better prompt for Gemini
        const prompt = `
        You are a job data processor. Convert this scraped job data into structured JSON.
        
        SCRAPED DATA:
        Title: ${scrapedData.title || 'Extract from description'}
        Company: ${scrapedData.company || 'Extract from description'}
        Location: ${scrapedData.location || 'Not specified'}
        Salary: ${scrapedData.salary || 'Competitive'}
        Type: ${scrapedData.employmentType || 'Full-time'}
        
        Description (${scrapedData.description?.length || 0} chars):
        ${scrapedData.description?.substring(0, 3000) || 'No description available'}
        
        IMPORTANT: Return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
        {
            "title": "actual job title from data",
            "company": "actual company name",
            "location": "actual location",
            "description": "clean, formatted description (minimum 200 words, use the actual text provided)",
            "salary": "salary range or 'Competitive' if not specified",
            "currency": "USD",
            "employmentType": "Full-time/Part-time/Contract",
            "workplaceType": "Remote/Hybrid/Onsite",
            "requirements": ["req1", "req2", "req3", "req4", "req5"],
            "responsibilities": ["resp1", "resp2", "resp3", "resp4", "resp5"],
            "companyInfo": {
                "about": "brief about company",
                "size": "company size",
                "industry": "industry type"
            }
        }
        
        Extract requirements and responsibilities from the description text.
        Use the ACTUAL data provided, don't make up information.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jobData = safeJsonParse(text);

        if (!jobData) {
            // Fallback: create basic structure from scraped data
            return {
                id: generateJobId(url),
                title: scrapedData.title || 'Job Opening',
                company: scrapedData.company || 'Company',
                location: scrapedData.location || 'Location not specified',
                description: scrapedData.description || 'Please visit the job page for full details.',
                salary: scrapedData.salary || 'Competitive',
                currency: 'USD',
                employmentType: scrapedData.employmentType || 'Full-time',
                workplaceType: 'Onsite',
                requirements: extractListFromText(scrapedData.description, 'requirements') || [
                    'Please visit the job page for requirements'
                ],
                responsibilities: extractListFromText(scrapedData.description, 'responsibilities') || [
                    'Please visit the job page for responsibilities'
                ],
                sourceUrl: url,
                postedDate: new Date(),
                matchScore: 70,
                matchReasons: ['Potential match'],
                missingSkills: []
            };
        }

        return {
            id: generateJobId(url),
            ...jobData,
            sourceUrl: url,
            postedDate: new Date(),
            matchScore: calculateMatchScore(jobData, refinements),
            matchReasons: generateMatchReasons(jobData, refinements),
            missingSkills: []
        };

    } catch (error) {
        console.error('Gemini error:', error);

        // Return basic structure with scraped data
        return {
            id: generateJobId(url),
            title: scrapedData.title || 'Job Opening',
            company: scrapedData.company || 'Company',
            location: scrapedData.location || 'Location not specified',
            description: scrapedData.description || 'Please visit the job page for full details.',
            salary: scrapedData.salary || 'Competitive',
            currency: 'USD',
            employmentType: 'Full-time',
            workplaceType: 'Onsite',
            requirements: ['Visit job page for full requirements'],
            responsibilities: ['Visit job page for full responsibilities'],
            sourceUrl: url,
            postedDate: new Date(),
            matchScore: 70,
            matchReasons: ['Potential match'],
            missingSkills: []
        };
    }
}

// Helper function to extract lists from text
function extractListFromText(text: string, type: string): string[] | null {
    if (!text) return null;

    const lines = text.split(/\n|•|·|★/);
    const items: string[] = [];

    let capturing = false;
    for (const line of lines) {
        if (line.toLowerCase().includes(type)) {
            capturing = true;
            continue;
        }

        if (capturing && line.trim().length > 10) {
            items.push(line.trim().substring(0, 150));
            if (items.length >= 5) break;
        }
    }

    return items.length > 0 ? items : null;
}


// Add deduplication function
// Improved deduplication with better matching
function removeDuplicateJobs(jobs: EnhancedJobListing[]): EnhancedJobListing[] {
    const uniqueJobs = new Map<string, EnhancedJobListing>();
    const seenTitles = new Set<string>();
    
    for (const job of jobs) {
        // Skip jobs with insufficient data
        if (!job.title || !job.company || job.title === 'Job Opening') {
            continue;
        }
        
        // Skip if description is too short (likely fake/incomplete)
        if (!job.description || job.description.length < 100) {
            continue;
        }
        
        // Create multiple signatures for better duplicate detection
        const titleCompany = `${job.title.toLowerCase().trim()}_${job.company.toLowerCase().trim()}`;
        const titleLocation = `${job.title.toLowerCase().trim()}_${job.location?.toLowerCase().trim()}`;
        
        // Skip if we've seen this job
        if (seenTitles.has(titleCompany) || seenTitles.has(titleLocation)) {
            continue;
        }
        
        // Add to unique jobs
        seenTitles.add(titleCompany);
        uniqueJobs.set(job.id, job);
    }
    
    return Array.from(uniqueJobs.values());
}

// Better unique ID generation
function generateJobId(url: string): string {
    // Create more unique ID using URL hash and random component
    const urlHash = url.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'job';
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `job_${urlHash}_${randomPart}_${Date.now()}`;
}


// Filter out low-quality jobs
function filterQualityJobs(jobs: EnhancedJobListing[]): EnhancedJobListing[] {
    return jobs.filter(job => {
        // Must have essential fields
        if (!job.title || !job.company || !job.description) {
            return false;
        }
        
        // Title should be meaningful
        if (job.title.length < 5 || job.title === 'Job Opening') {
            return false;
        }
        
        // Company name should be reasonable
        if (job.company === 'Company' || job.company.length < 2) {
            return false;
        }
        
        // Description should have substance
        if (job.description.length < 100 || job.description.includes('Please visit the job page')) {
            return false;
        }
        
        // Should have at least some requirements/responsibilities
        if ((!job.requirements || job.requirements.length === 0) && 
            (!job.responsibilities || job.responsibilities.length === 0)) {
            return false;
        }
        
        return true;
    });
}



// Add date extraction and checking function
function extractJobDate(text: string): Date | null {
    if (!text) return null;
    
    // Common date patterns in job postings
    const patterns = [
        /posted\s+today/i,
        /posted\s+(\d+)\s+hour[s]?\s+ago/i,
        /posted\s+yesterday/i,
        /posted\s+(\d+)\s+day[s]?\s+ago/i,
        /posted\s+(\d+)\s+week[s]?\s+ago/i,
        /posted\s+(\d+)\s+month[s]?\s+ago/i,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
        /(\d{1,2})-(\d{1,2})-(\d{2,4})/
    ];
    
    const now = new Date();
    
    // Check for "today"
    if (/today/i.test(text)) {
        return now;
    }
    
    // Check for "yesterday"
    if (/yesterday/i.test(text)) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    }
    
    // Check for "X hours ago"
    const hoursMatch = text.match(/(\d+)\s+hour[s]?\s+ago/i);
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1]);
        const date = new Date(now);
        date.setHours(date.getHours() - hours);
        return date;
    }
    
    // Check for "X days ago"
    const daysMatch = text.match(/(\d+)\s+day[s]?\s+ago/i);
    if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        if (days > 4) return null; // Too old
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
    }
    
    // Check for "X weeks ago"
    const weeksMatch = text.match(/(\d+)\s+week[s]?\s+ago/i);
    if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1]);
        if (weeks >= 1) return null; // More than a week is too old
        const date = new Date(now);
        date.setDate(date.getDate() - (weeks * 7));
        return date;
    }
    
    // If months or no date found, consider it too old
    if (/month[s]?\s+ago/i.test(text)) {
        return null;
    }
    
    return null; // No date found or too old
}


// Update processJobResult to check dates
async function processJobResult(
    result: any,
    refinements: SearchRefinements
): Promise<EnhancedJobListing[]> {
    const jobs: EnhancedJobListing[] = [];
    
    try {
        // Check date in search result snippet first
        const snippetDate = extractJobDate(result.snippet || '');
        const titleDate = extractJobDate(result.title || '');
        
        // If we can detect it's old from the snippet, skip it
        if ((snippetDate === null && result.snippet?.includes('ago')) || 
            (titleDate === null && result.title?.includes('ago'))) {
            console.log('Skipping old job from snippet:', result.title);
            return [];
        }
        
        // Skip obviously non-job URLs
        const url = result.link?.toLowerCase() || '';
        if (url.includes('/search?') || 
            url.includes('?q=') || 
            url.includes('job-search') ||
            url.includes('browse-jobs')) {
            return [];
        }
        
        // Call cloud function to scrape the page
        const scraped = await fetchJobPageContent(result.link);
        
        if (!scraped || scraped.error) {
            return [];
        }

        // Handle job list
        if (scraped.type === 'list' && scraped.jobs && scraped.jobs.length > 0) {
            for (const jobInfo of scraped.jobs.slice(0, 3)) {
                if (jobInfo.url) {
                    const jobPageData = await fetchJobPageContent(jobInfo.url);
                    
                    if (jobPageData && jobPageData.type === 'single' && jobPageData.job) {
                        const structuredJob = await structureJobWithGemini(
                            jobPageData.job, 
                            jobInfo.url, 
                            refinements
                        );
                        
                        // Check job date
                        if (structuredJob) {
                            const jobDate = extractJobDate(jobPageData.job.description || '');
                            if (jobDate === null && jobPageData.job.description?.includes('ago')) {
                                console.log('Skipping old job:', structuredJob.title);
                                continue;
                            }
                            
                            // Set proper posted date
                            structuredJob.postedDate = jobDate || new Date();
                            jobs.push(structuredJob);
                        }
                    }
                }
            }
        } 
        // Handle single job
        else if (scraped.type === 'single' && scraped.job) {
            if (!scraped.job.title || !scraped.job.description || 
                scraped.job.description.length < 50) {
                return [];
            }
            
            // Check if job is fresh
            const jobDate = extractJobDate(scraped.job.description || '');
            if (jobDate === null && scraped.job.description?.includes('ago')) {
                console.log('Skipping old job:', scraped.job.title);
                return [];
            }
            
            const structuredJob = await structureJobWithGemini(
                scraped.job, 
                result.link, 
                refinements
            );
            
            if (structuredJob) {
                structuredJob.postedDate = jobDate || new Date();
                jobs.push(structuredJob);
            }
        }
        
        return jobs;
    } catch (error) {
        return [];
    }
}

// Update searchWithRefinements to focus on fresh jobs
export async function searchWithRefinements(
    query: string,
    refinements: SearchRefinements
): Promise<EnhancedJobListing[]> {
    try {
        const location = refinements.location?.city || '';
        const allJobs: EnhancedJobListing[] = [];
        const processedUrls = new Set<string>();
        
        // Add time-based search terms for fresher results
        const freshTerms = [
            'posted today',
            'posted yesterday', 
            'hiring now',
            'urgently hiring',
            'new'
        ];
        
        // Build searches with fresh job indicators
        const searches = [
            `${query} ${location} "posted today" OR "posted yesterday" site:linkedin.com/jobs/view`,
            `${query} ${location} "urgently hiring" site:indeed.com/viewjob`,
            `${query} ${location} "new" "hiring" site:glassdoor.com`,
            `${query} ${location} "posted 1 day ago" OR "posted 2 days ago"`,
            `${query} ${location} ${freshTerms[Math.floor(Math.random() * freshTerms.length)]}`
        ];
        
        console.log('Searching for fresh jobs (max 4 days old)...');
        
        for (const searchQuery of searches) {
            try {
                const serperResponse = await axios.post(
                    'https://google.serper.dev/search',
                    { 
                        q: searchQuery,
                        num: 10,
                        // Add time range parameter if Serper supports it
                        gl: 'us',
                    },
                    {
                        headers: {
                            'X-API-KEY': process.env.NEXT_PUBLIC_SERPER_API_KEY!,
                            'Content-Type': 'application/json',
                        },
                        timeout: 10000
                    }
                );

                const searchResults = serperResponse.data.organic || [];
                
                for (const result of searchResults) {
                    // Skip if already processed
                    if (processedUrls.has(result.link)) {
                        continue;
                    }
                    processedUrls.add(result.link);
                    
                    // Check date in snippet before processing
                    if (result.snippet) {
                        const snippetLower = result.snippet.toLowerCase();
                        // Skip if obviously old
                        if (snippetLower.includes('week') && snippetLower.includes('ago')) {
                            console.log('Skipping week old job');
                            continue;
                        }
                        if (snippetLower.includes('month') && snippetLower.includes('ago')) {
                            console.log('Skipping month old job');
                            continue;
                        }
                        // Skip if more than 4 days
                        const daysMatch = snippetLower.match(/(\d+)\s+days?\s+ago/);
                        if (daysMatch && parseInt(daysMatch[1]) > 4) {
                            console.log(`Skipping ${daysMatch[1]} days old job`);
                            continue;
                        }
                    }
                    
                    const jobs = await processJobResult(result, refinements);
                    allJobs.push(...jobs);
                    
                    if (allJobs.length >= 25) break;
                }
                
            } catch (error) {
                console.error(`Search failed for: ${searchQuery.split('site:')[1]?.split(' ')[0] || 'general'}`);
                continue;
            }
            
            if (allJobs.length >= 25) break;
        }
        
        console.log(`Found ${allJobs.length} fresh jobs`);
        
        // Final date filter
        const freshJobs = allJobs.filter(job => {
            const daysSincePosted = Math.floor(
                (new Date().getTime() - new Date(job.postedDate).getTime()) / 
                (1000 * 60 * 60 * 24)
            );
            return daysSincePosted <= 4; // Max 4 days old
        });
        
        console.log(`After date filter: ${freshJobs.length} jobs (max 4 days old)`);
        
        // Remove duplicates and filter quality
        let uniqueJobs = removeDuplicateJobs(freshJobs);
        uniqueJobs = filterQualityJobs(uniqueJobs);
        
        // Sort by date (newest first) then by match score
        uniqueJobs.sort((a, b) => {
            // First sort by date
            const dateA = new Date(a.postedDate).getTime();
            const dateB = new Date(b.postedDate).getTime();
            if (dateB !== dateA) {
                return dateB - dateA; // Newer first
            }
            // Then by match score
            return b.matchScore - a.matchScore;
        });
        
        const finalJobs = uniqueJobs.slice(0, 20);
        console.log(`Returning ${finalJobs.length} fresh, quality jobs`);
        
        return finalJobs;
        
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}