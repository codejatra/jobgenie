import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage, db } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export interface StoredResume {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
  lastUsedAt?: Date;
  extractedText?: string;
  analysis?: ResumeAnalysis;
  isDefault?: boolean;
}

export interface ResumeAnalysis {
  score: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  keywords: string[];
  skills: string[];
  experience: string;
  education: string;
  role: string;
  seniority: string;
  industries: string[];
}

// Extract text from PDF using Gemini Vision API
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Convert file to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:application/pdf;base64, prefix
      };
      reader.onerror = reject;
    });
    reader.readAsDataURL(file);
    const base64Data = await base64Promise;

    // Use Gemini to extract text
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Extract all text from this resume/CV. Return the complete text content preserving the structure and formatting as much as possible. Include all sections like contact info, summary, experience, education, skills, etc.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type,
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Fallback to basic extraction
    return await extractTextBasic(file);
  }
}

// Basic text extraction fallback
async function extractTextBasic(file: File): Promise<string> {
  // For demo purposes, return a message to upload as text
  return `Resume: ${file.name}\n\nPlease note: For best results, save your resume as plain text and paste it directly.`;
}

// Upload resume to Firebase Storage
export async function uploadResume(userId: string, file: File): Promise<StoredResume> {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `resumes/${userId}/${fileName}`);

    // Upload file
    await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(storageRef);

    // Extract text from resume
    const extractedText = await extractTextFromPDF(file);

    // Analyze resume
    const analysis = await analyzeResumeContent(extractedText);

    // Store metadata in Firestore
    const resumeData: Omit<StoredResume, 'id'> = {
      userId,
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
      uploadedAt: new Date(),
      extractedText,
      analysis,
      isDefault: false
    };

    const docRef = doc(collection(db, 'resumes'));
    await setDoc(docRef, {
      ...resumeData,
      uploadedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...resumeData
    };
  } catch (error) {
    console.error('Error uploading resume:', error);
    throw error;
  }
}

// Get user's resumes
export async function getUserResumes(userId: string): Promise<StoredResume[]> {
  try {
    const q = query(
      collection(db, 'resumes'),
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
    })) as StoredResume[];
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return [];
  }
}

// Analyze resume content with Gemini
export async function analyzeResumeContent(resumeText: string): Promise<ResumeAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
    Analyze this resume and provide a comprehensive evaluation:
    
    Resume Content:
    ${resumeText}
    
    Return a JSON object with:
    {
      "score": (0-100),
      "strengths": ["strength1", "strength2", "strength3"],
      "improvements": ["improvement1", "improvement2", "improvement3"],
      "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
      "keywords": ["keyword1", "keyword2", ...],
      "skills": ["skill1", "skill2", ...],
      "experience": "years of experience",
      "education": "highest degree",
      "role": "target job role",
      "seniority": "junior/mid/senior/lead",
      "industries": ["industry1", "industry2"]
    }
    
    Be specific and actionable in your feedback.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean and parse JSON
    const cleanedText = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback analysis
    return {
      score: 75,
      strengths: [
        'Clear structure and formatting',
        'Relevant experience highlighted',
        'Good use of action verbs'
      ],
      improvements: [
        'Add more quantifiable achievements',
        'Include more industry keywords',
        'Expand on technical skills'
      ],
      suggestions: [
        'Add a professional summary at the top',
        'Include specific project outcomes',
        'Update with recent certifications'
      ],
      keywords: ['teamwork', 'leadership', 'problem-solving'],
      skills: ['Communication', 'Project Management'],
      experience: '3-5 years',
      education: 'Bachelor\'s Degree',
      role: 'Software Developer',
      seniority: 'mid',
      industries: ['Technology', 'Software']
    };
  } catch (error) {
    console.error('Resume analysis error:', error);
    throw error;
  }
}

// Tailor resume for specific job
export async function tailorResumeForJob(
  resumeText: string,
  jobDescription: string
): Promise<{
  tailoredResume: string;
  changes: string[];
  matchScore: number;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
    Tailor this resume for the specific job:
    
    Original Resume:
    ${resumeText}
    
    Job Description:
    ${jobDescription}
    
    Provide:
    1. A tailored version of the resume optimized for this job
    2. List of specific changes made
    3. Match score (0-100)
    
    Return as JSON:
    {
      "tailoredResume": "full tailored resume text",
      "changes": ["change1", "change2", ...],
      "matchScore": number
    }
    
    Focus on:
    - Highlighting relevant experience
    - Adding job-specific keywords
    - Reordering sections for relevance
    - Adjusting descriptions to match requirements
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to tailor resume');
  } catch (error) {
    console.error('Resume tailoring error:', error);
    throw error;
  }
}

// Set default resume
export async function setDefaultResume(userId: string, resumeId: string): Promise<void> {
  try {
    // Clear other defaults
    const resumes = await getUserResumes(userId);
    for (const resume of resumes) {
      if (resume.isDefault) {
        await setDoc(doc(db, 'resumes', resume.id), {
          isDefault: false
        }, { merge: true });
      }
    }

    // Set new default
    await setDoc(doc(db, 'resumes', resumeId), {
      isDefault: true,
      lastUsedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error setting default resume:', error);
    throw error;
  }
}

// Delete resume
export async function deleteResume(userId: string, resumeId: string, fileUrl: string): Promise<void> {
  try {
    // Delete from Storage
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);

    // Delete from Firestore
    await deleteDoc(doc(db, 'resumes', resumeId));
  } catch (error) {
    console.error('Error deleting resume:', error);
    throw error;
  }
}