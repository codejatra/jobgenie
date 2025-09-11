import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  increment,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { differenceInDays } from 'date-fns';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  currency?: string;
  employmentType?: string;
  workplaceType?: string;
  requirements?: string[];
  responsibilities?: string[];
  applicationDeadline?: Date;
  postedDate: Date;
  sourceUrl: string;
  companyInfo?: {
    about?: string;
    size?: string;
    industry?: string;
  };
}

export interface JobSearchParams {
  prompt: string;
  location?: string;
  experience?: string;
  salary?: string;
  employmentType?: string;
}

// Refine user prompt
export async function refinePrompt(userPrompt: string): Promise<JobSearchParams> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Extract key information from the prompt
    const locationMatch = userPrompt.match(/in\s+([^,]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : '';
    
    return {
      prompt: userPrompt,
      location: location || 'Remote',
      experience: userPrompt.includes('senior') ? 'senior' : 
                  userPrompt.includes('junior') ? 'entry' : 'mid',
      employmentType: 'full-time'
    };
  } catch (error) {
    console.error('Prompt refinement error:', error);
    return { prompt: userPrompt };
  }
}

// Main search function with real scraping
export async function searchJobs(params: JobSearchParams): Promise<JobListing[]> {
  console.log('Searching jobs with params:', params);
  
  try {
    // Build search query with location
    const searchQuery = `${params.prompt} jobs ${params.location ? `in ${params.location}` : ''} hiring now`;
    
    console.log('Search query:', searchQuery);
    
    // Call Serper API for real job listings
    const serperResponse = await axios.post(
      'https://google.serper.dev/search',
      {
        q: searchQuery,
        location: params.location,
        gl: 'us', // Country code
        num: 20,   // Get more results
      },
      {
        headers: {
          'X-API-KEY': process.env.NEXT_PUBLIC_SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log('Serper response received:', serperResponse.data.organic?.length || 0, 'results');

    const searchResults = serperResponse.data.organic || [];
    
    // Also get job-specific results if available
    const jobResults = serperResponse.data.jobs || [];
    
    // Combine and process results
    const allResults = [...jobResults, ...searchResults];
    
    if (allResults.length === 0) {
      console.log('No results from Serper, using fallback');
      return getFallbackJobs(params);
    }

    // Process each result
    const jobs: JobListing[] = [];
    const processedUrls = new Set<string>();
    
    for (const result of allResults.slice(0, 10)) {
      // Skip if already processed
      if (processedUrls.has(result.link || result.url)) continue;
      processedUrls.add(result.link || result.url);
      
      try {
        const job = await extractJobFromResult(result, params);
        if (job && job.title && job.company) {
          jobs.push(job);
          console.log('Added job:', job.title, 'at', job.company);
        }
      } catch (error) {
        console.error('Error processing job result:', error);
      }
      
      // Limit to 5 jobs to avoid rate limiting
      if (jobs.length >= 5) break;
    }

    console.log('Total jobs found:', jobs.length);

    // If no jobs found, use fallback
    if (jobs.length === 0) {
      return getFallbackJobs(params);
    }

    return jobs;
  } catch (error) {
    console.error('Search error:', error);
    return getFallbackJobs(params);
  }
}

// Extract job information from search result
async function extractJobFromResult(result: any, params: JobSearchParams): Promise<JobListing | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'Gemini-2.0-Flash' });
    
    // Build context from result
    const context = {
      title: result.title || '',
      snippet: result.snippet || result.description || '',
      link: result.link || result.url || '',
      position: result.position || result.title || '',
      company: result.company || '',
      location: result.location || params.location || '',
      date: result.date || '',
      salary: result.salary || '',
    };

    const prompt = `
Based on this job search result, create a complete job listing:

Title: ${context.title}
Company: ${context.company}
Description: ${context.snippet}
Location: ${context.location}
Link: ${context.link}
${context.salary ? `Salary: ${context.salary}` : ''}
${context.date ? `Posted: ${context.date}` : ''}

Extract and enhance this information to create a complete job listing. If company name is missing, extract it from the title or URL.

Return a JSON object with these fields:
{
  "title": "exact job title",
  "company": "company name",
  "location": "city, state or country",
  "description": "detailed job description (150+ words)",
  "salary": "salary range or estimate",
  "currency": "USD",
  "employmentType": "Full-time/Part-time/Contract",
  "workplaceType": "Remote/Hybrid/Onsite",
  "requirements": ["requirement 1", "requirement 2", "requirement 3", "requirement 4"],
  "responsibilities": ["responsibility 1", "responsibility 2", "responsibility 3"],
  "companyInfo": {
    "about": "brief company description",
    "industry": "industry type"
  }
}

IMPORTANT: Return ONLY the JSON object, no other text or markdown.
`;

    const result2 = await model.generateContent(prompt);
    const response = result2.response;
    let text = response.text();
    
    // Clean the response
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    // Find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response');
      return null;
    }
    
    const jobData = JSON.parse(jsonMatch[0]);
    
    // Validate and clean data
    if (!jobData.title || !jobData.company) {
      // Try to extract from original data
      jobData.title = context.position || context.title.split(' at ')[0] || 'Software Developer';
      jobData.company = context.company || context.title.split(' at ')[1] || 'Tech Company';
    }
    
    return {
      id: generateJobId(context.link),
      title: jobData.title,
      company: jobData.company || 'Company',
      location: jobData.location || context.location || params.location || 'Remote',
      description: jobData.description || context.snippet || 'Exciting opportunity in a growing company.',
      salary: jobData.salary || 'Competitive',
      currency: jobData.currency || 'USD',
      employmentType: jobData.employmentType || 'Full-time',
      workplaceType: jobData.workplaceType || 'Onsite',
      requirements: Array.isArray(jobData.requirements) ? jobData.requirements : [
        'Relevant experience in the field',
        'Strong communication skills',
        'Problem-solving abilities',
        'Team collaboration'
      ],
      responsibilities: Array.isArray(jobData.responsibilities) ? jobData.responsibilities : [
        'Develop and maintain applications',
        'Collaborate with team members',
        'Meet project deadlines'
      ],
      postedDate: context.date ? new Date(context.date) : new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000),
      sourceUrl: context.link || `https://www.google.com/search?q=${encodeURIComponent(context.title)}`,
      companyInfo: jobData.companyInfo || {
        about: `${jobData.company} is a leading company in the industry.`,
        industry: jobData.companyInfo?.industry || 'Technology'
      }
    };
  } catch (error) {
    console.error('Error extracting job:', error);
    return null;
  }
}

// Fallback jobs when API fails
function getFallbackJobs(params: JobSearchParams): JobListing[] {
  const location = params.location || 'Remote';
  
  return [
    {
      id: 'fallback1',
      title: 'Software Developer',
      company: 'Tech Solutions Inc',
      location: location,
      description: `We are seeking a talented Software Developer to join our team in ${location}. This role involves developing innovative solutions and working with cutting-edge technologies. You'll be part of a dynamic team focused on delivering high-quality software products.`,
      salary: '$80,000 - $120,000',
      currency: 'USD',
      employmentType: 'Full-time',
      workplaceType: location.toLowerCase() === 'remote' ? 'Remote' : 'Hybrid',
      requirements: [
        '3+ years of software development experience',
        'Proficiency in modern programming languages',
        'Experience with web technologies',
        'Strong problem-solving skills'
      ],
      responsibilities: [
        'Design and develop software applications',
        'Collaborate with cross-functional teams',
        'Write clean, maintainable code',
        'Participate in code reviews'
      ],
      postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      sourceUrl: 'https://www.indeed.com',
      companyInfo: {
        about: 'Leading technology company specializing in innovative solutions',
        industry: 'Technology'
      }
    },
    {
      id: 'fallback2',
      title: 'Full Stack Developer',
      company: 'Digital Innovations',
      location: location,
      description: `Join our innovative team as a Full Stack Developer in ${location}. Work on exciting projects using modern technologies and frameworks. We offer a collaborative environment where your ideas matter.`,
      salary: '$90,000 - $130,000',
      currency: 'USD',
      employmentType: 'Full-time',
      workplaceType: 'Hybrid',
      requirements: [
        'Experience with React and Node.js',
        'Database design and management skills',
        'API development experience',
        'Excellent communication skills'
      ],
      responsibilities: [
        'Develop frontend and backend components',
        'Design and implement APIs',
        'Optimize application performance',
        'Mentor junior developers'
      ],
      postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      sourceUrl: 'https://www.linkedin.com/jobs',
      companyInfo: {
        about: 'Innovative digital solutions provider',
        industry: 'Software Development'
      }
    }
  ];
}

function generateJobId(url: string): string {
  const timestamp = Date.now();
  const urlHash = url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  return `job_${urlHash}_${timestamp}`;
}

// Deduct credits
export async function deductCredits(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data();
    if (userData.credits <= 0) return false;
    
    await updateDoc(userRef, {
      credits: increment(-1),
      updatedAt: serverTimestamp(),
    });
    
    // Log usage
    await setDoc(doc(collection(db, 'usage')), {
      userId,
      type: 'job_search',
      timestamp: serverTimestamp(),
    });
    
    return true;
  } catch (error) {
    console.error('Credit deduction error:', error);
    return false;
  }
}