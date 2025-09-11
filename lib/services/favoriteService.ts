import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { JobListing } from './jobService';

export interface FavoriteJob extends JobListing {
  favoriteId?: string; // Add this for deletion
  savedAt: Date;
  notes?: string;
}

export async function saveFavoriteJob(userId: string, job: JobListing, notes?: string): Promise<void> {
  // Use addDoc to auto-generate ID
  await addDoc(collection(db, 'favorites'), {
    ...job,
    userId,
    notes: notes || '',
    savedAt: serverTimestamp(),
  });
}

export async function removeFavoriteJob(favoriteId: string): Promise<void> {
  if (!favoriteId) {
    throw new Error('Favorite ID is required');
  }
  
  console.log('Removing favorite with ID:', favoriteId);
  const favoriteRef = doc(db, 'favorites', favoriteId);
  await deleteDoc(favoriteRef);
}

export function subscribeFavorites(
  userId: string, 
  callback: (favorites: FavoriteJob[]) => void
): () => void {
  const q = query(
    collection(db, 'favorites'),
    where('userId', '==', userId),
    orderBy('savedAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const favorites = snapshot.docs.map(doc => ({
      ...doc.data(),
      favoriteId: doc.id, // Include the document ID for deletion
      id: doc.data().id || doc.id, // Use original job ID or doc ID
      savedAt: doc.data().savedAt?.toDate() || new Date(),
    })) as FavoriteJob[];
    
    callback(favorites);
  });

  return unsubscribe;
}