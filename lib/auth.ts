import { auth, db } from "./firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore"

export type UserRole = "admin" | "publisher" | "subscriber"

export interface UserProfile {
  uid: string
  email: string
  role: UserRole
  displayName?: string
  zoomUserId?: string
  zoomUserEmail?: string
  createdAt: Date
  isActive: boolean
}

export interface UserSession {
  userId: string
  sessionId: string
  createdAt: Date
  lastActive: Date
  userAgent: string
  ipAddress: string
  userEmail?: string
  userName?: string
}

// Generate a unique session ID
const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

// Get current session ID from localStorage
export const getCurrentSessionId = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sessionId')
}

// Get user's IP address
const getUserIpAddress = async (): Promise<string> => {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
    
    const response = await fetch('/api/get-ip', { signal: controller.signal })
    clearTimeout(timeoutId)
    
    const data = await response.json()
    return data.ip || 'unknown'
  } catch (error) {
    console.error('Error fetching IP:', error)
    return 'unknown'
  }
}

// Create a new session for a user
const createSession = async (userId: string, role: UserRole, userEmail?: string, userName?: string): Promise<string> => {
  // Only enforce single-session for subscribers
  if (role !== 'subscriber') {
    console.log("Skipping session creation for non-subscriber")
    return 'no-session-required'
  }

  console.log("Creating session for subscriber...")
  const sessionId = generateSessionId()
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  
  console.log("Fetching IP address...")
  const ipAddress = await getUserIpAddress()
  console.log("IP address fetched:", ipAddress)

  // Delete all existing sessions for this user (enforce single session)
  console.log("Deleting existing sessions...")
  const sessionsRef = collection(db, "sessions")
  const q = query(sessionsRef, where("userId", "==", userId))
  const querySnapshot = await getDocs(q)
  
  const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)
  console.log(`Deleted ${querySnapshot.docs.length} existing sessions`)

  // Create new session
  const sessionData: UserSession = {
    userId,
    sessionId,
    createdAt: new Date(),
    lastActive: new Date(),
    userAgent,
    ipAddress,
    userEmail,
    userName,
  }

  console.log("Writing session to Firestore...")
  await setDoc(doc(db, "sessions", sessionId), sessionData)
  console.log("Session written to Firestore")

  // Store session ID in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('sessionId', sessionId)
    console.log("Session ID stored in localStorage")
  }

  return sessionId
}

// Validate if current session is still active
export const validateSession = async (userId: string, role: UserRole): Promise<boolean> => {
  // Only validate session for subscribers
  if (role !== 'subscriber') {
    return true
  }

  const sessionId = getCurrentSessionId()
  if (!sessionId) {
    console.log("No session ID found in localStorage")
    return false
  }

  try {
    const sessionDoc = await getDoc(doc(db, "sessions", sessionId))
    
    if (!sessionDoc.exists()) {
      console.log("Session document does not exist:", sessionId)
      return false
    }

    const sessionData = sessionDoc.data() as UserSession
    
    // Check if session belongs to current user
    if (sessionData.userId !== userId) {
      console.log("Session belongs to different user")
      return false
    }

    // Update last active time
    await setDoc(doc(db, "sessions", sessionId), {
      ...sessionData,
      lastActive: new Date(),
    })

    return true
  } catch (error) {
    console.error("Error validating session:", error)
    // Be lenient on errors - don't kick out user if there's a network issue
    return true
  }
}

// Delete session
const deleteSession = async (sessionId: string | null) => {
  if (!sessionId) return

  try {
    await deleteDoc(doc(db, "sessions", sessionId))
  } catch (error) {
    console.error("Error deleting session:", error)
  }

  // Clear from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sessionId')
  }
}

export const signIn = async (email: string, password: string) => {
  try {
    console.log("Starting sign in process...")
    const result = await signInWithEmailAndPassword(auth, email, password)
    console.log("Firebase auth successful, user:", result.user.uid)
    
    // Get user profile to check role
    const profile = await getUserProfile(result.user.uid)
    console.log("User profile loaded:", profile?.role)
    
    if (profile) {
      // Create session (will invalidate any existing sessions for subscribers)
      console.log("Creating session for user...")
      await createSession(result.user.uid, profile.role, profile.email, profile.displayName)
      console.log("Session created successfully")
    }
    
    return { user: result.user, error: null }
  } catch (error: any) {
    console.error("Sign in error:", error)
    return { user: null, error: error.message }
  }
}

export const signUp = async (email: string, password: string, role: UserRole, displayName?: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)

    // Create user profile in Firestore
    const userProfile: UserProfile = {
      uid: result.user.uid,
      email: result.user.email!,
      role,
      displayName: displayName || email.split("@")[0],
      createdAt: new Date(),
      isActive: true,
    }

    await setDoc(doc(db, "users", result.user.uid), userProfile)

    return { user: result.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const signOut = async () => {
  try {
    // Delete session before signing out
    const sessionId = getCurrentSessionId()
    await deleteSession(sessionId)
    
    await firebaseSignOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, "users", uid)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile
    }
    return null
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return null
  }
}

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}
