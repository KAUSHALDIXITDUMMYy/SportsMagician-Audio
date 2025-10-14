"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import { type UserSession } from "@/lib/auth"
import { 
  Monitor, 
  Globe, 
  Clock, 
  User, 
  RefreshCw,
  AlertCircle,
  Activity,
  MapPin,
  Laptop
} from "lucide-react"

export function SubscriberMonitoring() {
  const [sessions, setSessions] = useState<(UserSession & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const sessionsRef = collection(db, "sessions")
    const q = query(sessionsRef, orderBy("lastActive", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
          lastActive: doc.data().lastActive?.toDate?.() || new Date(doc.data().lastActive),
        })) as (UserSession & { id: string })[]
        
        setSessions(sessionsData)
        setLoading(false)
        setError("")
      },
      (err) => {
        setError("Failed to load sessions")
        console.error("Error loading sessions:", err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getBrowserInfo = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return { name: 'Chrome', icon: '🌐' }
    if (userAgent.includes('Firefox')) return { name: 'Firefox', icon: '🦊' }
    if (userAgent.includes('Safari')) return { name: 'Safari', icon: '🧭' }
    if (userAgent.includes('Edge')) return { name: 'Edge', icon: '🔷' }
    if (userAgent.includes('Opera')) return { name: 'Opera', icon: '🎭' }
    return { name: 'Unknown', icon: '🌐' }
  }

  const getDeviceType = (userAgent: string) => {
    if (/mobile/i.test(userAgent)) return 'Mobile'
    if (/tablet/i.test(userAgent)) return 'Tablet'
    return 'Desktop'
  }

  const isSessionActive = (lastActive: Date) => {
    const minutesAgo = (Date.now() - new Date(lastActive).getTime()) / 1000 / 60
    return minutesAgo < 2 // Active if last activity within 2 minutes
  }

  const activeSessions = sessions.filter(s => isSessionActive(s.lastActive))
  const totalSessions = sessions.length

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">All subscriber sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(sessions.map(s => s.ipAddress)).size}
            </div>
            <p className="text-xs text-muted-foreground">Different locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Subscriber Sessions Monitor</span>
              </CardTitle>
              <CardDescription>Real-time tracking of subscriber locations and activities</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active subscriber sessions</p>
              <p className="text-sm">Sessions will appear here when subscribers log in</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscriber</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Browser/Device</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Session Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const browser = getBrowserInfo(session.userAgent)
                    const deviceType = getDeviceType(session.userAgent)
                    const active = isSessionActive(session.lastActive)
                    const duration = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000 / 60)

                    return (
                      <TableRow key={session.id} className={active ? "bg-green-50 dark:bg-green-950/20" : ""}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {active ? (
                              <Badge variant="default" className="bg-green-600 flex items-center space-x-1">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                <span>Online</span>
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Offline</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{session.userName || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{session.userEmail}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {session.ipAddress}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Laptop className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-medium">{browser.icon} {browser.name}</div>
                              <div className="text-xs text-muted-foreground">{deviceType}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{new Date(session.createdAt).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {getTimeAgo(session.lastActive)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IP Summary Card */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>IP Address Summary</span>
            </CardTitle>
            <CardDescription>Distribution of subscriber connections by IP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(new Set(sessions.map(s => s.ipAddress))).map(ip => {
                const ipSessions = sessions.filter(s => s.ipAddress === ip)
                const activeCount = ipSessions.filter(s => isSessionActive(s.lastActive)).length
                
                return (
                  <div key={ip} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                        {ip}
                      </code>
                      {activeCount > 0 && (
                        <Badge variant="default" className="bg-green-600">
                          {activeCount} Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ipSessions.length} session{ipSessions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}





