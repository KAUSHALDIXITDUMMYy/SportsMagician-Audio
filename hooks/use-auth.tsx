"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChange, getUserProfile, validateSession, signOut, getCurrentSessionId, type UserProfile } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user)

      if (user) {
        const profile = await getUserProfile(user.uid)
        setUserProfile(profile)

        // Skip immediate validation for subscribers on initial auth
        // The periodic validation will catch invalid sessions
        // This prevents the infinite loop on login when session is being created
      } else {
        setUserProfile(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Real-time session monitoring for subscribers
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== 'subscriber') {
      return
    }

    const sessionId = getCurrentSessionId()
    if (!sessionId || sessionId === 'no-session-required') {
      return
    }

    console.log("Setting up real-time session listener for:", sessionId)

    // Listen to the session document in real-time
    const sessionRef = doc(db, "sessions", sessionId)
    let isFirstSnapshot = true // Skip the first snapshot to avoid false positives
    
    const unsubscribe = onSnapshot(
      sessionRef,
      (snapshot) => {
        // Skip first snapshot (initial state)
        if (isFirstSnapshot) {
          isFirstSnapshot = false
          return
        }
        
        if (!snapshot.exists()) {
          // Session was deleted (user logged in from another browser)
          console.log("⚠️ Session deleted - Another device logged in with your account")
          alert("Your account has been logged in from another device. You will be logged out now.")
          signOut()
        } else {
          const sessionData = snapshot.data()
          if (sessionData.userId !== user.uid) {
            // Session belongs to different user
            console.log("Session belongs to different user - logging out")
            signOut()
          }
        }
      },
      (error) => {
        console.error("Error monitoring session:", error)
      }
    )

    // Also do periodic validation as backup
    const validateSessionPeriodically = async () => {
      const isValid = await validateSession(user.uid, userProfile.role)
      if (!isValid) {
        console.log("Session invalidated during periodic check - logging out")
        await signOut()
      }
    }

    // Validate after 3 seconds (to allow session creation), then every 30 seconds
    const initialTimeout = setTimeout(validateSessionPeriodically, 3000)
    const interval = setInterval(validateSessionPeriodically, 30000)

    return () => {
      unsubscribe()
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [user, userProfile])

  return <AuthContext.Provider value={{ user, userProfile, loading }}>{children}</AuthContext.Provider>
}
