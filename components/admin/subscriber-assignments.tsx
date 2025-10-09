"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getUsersByRole, createStreamPermission, deleteStreamPermission, updateStreamPermission, type StreamPermission } from "@/lib/admin"
import type { UserProfile } from "@/lib/auth"
import { permissionsManager } from "@/lib/permissions"
import { CheckCircle2, Circle, Users, UserPlus, UserMinus, Video, Volume2 } from "lucide-react"

export function SubscriberAssignments() {
  const [subscribers, setSubscribers] = useState<(UserProfile & { id: string })[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [subscriberPermissions, setSubscriberPermissions] = useState<StreamPermission[]>([])
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [subs, pubs] = await Promise.all([getUsersByRole("subscriber"), getUsersByRole("publisher")])
      setSubscribers(subs as any)
      setPublishers(pubs as any)
      setLoading(false)
      if (subs.length > 0) setSelectedSubscriberId((subs as any)[0].id)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedSubscriberId) return
    const unsubscribe = permissionsManager.subscribeToUserPermissions(selectedSubscriberId, (perms) => {
      setSubscriberPermissions(perms)
    })
    return () => unsubscribe()
  }, [selectedSubscriberId])

  const filteredSubscribers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter((s) => (s.displayName || s.email).toLowerCase().includes(q))
  }, [search, subscribers])

  const assignedPublisherIds = useMemo(() => new Set(subscriberPermissions.map((p) => p.publisherId)), [subscriberPermissions])

  const assignedCount = assignedPublisherIds.size
  const totalPublishers = publishers.length

  const selectedSubscriber = subscribers.find(s => s.id === selectedSubscriberId)

  const toggleAssignment = async (publisherId: string, nextAssigned: boolean) => {
    if (!selectedSubscriberId) return
    setError("")
    setSuccess("")

    const existing = subscriberPermissions.find((p) => p.publisherId === publisherId)
    try {
      if (nextAssigned) {
        if (!existing) {
          await createStreamPermission({
            publisherId,
            subscriberId: selectedSubscriberId,
            allowVideo: true,
            allowAudio: true,
            isActive: true,
          })
          setSuccess("Publisher assigned successfully!")
        } else if (!existing.isActive) {
          await updateStreamPermission(existing.id!, { isActive: true })
          setSuccess("Assignment re-activated!")
        }
      } else {
        if (existing) {
          await deleteStreamPermission(existing.id!)
          setSuccess("Publisher unassigned successfully!")
        }
      }
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: any) {
      setError(e?.message || "Operation failed")
      setTimeout(() => setError(""), 5000)
    }
  }

  const assignAllPublishers = async () => {
    if (!selectedSubscriberId || processing) return
    setProcessing(true)
    setError("")
    setSuccess("")
    
    let assigned = 0
    let failed = 0

    for (const publisher of publishers) {
      if (!assignedPublisherIds.has(publisher.id)) {
        try {
          await createStreamPermission({
            publisherId: publisher.id,
            subscriberId: selectedSubscriberId,
            allowVideo: true,
            allowAudio: true,
            isActive: true,
          })
          assigned++
        } catch (e) {
          failed++
        }
      }
    }

    setProcessing(false)
    if (assigned > 0) {
      setSuccess(`Successfully assigned ${assigned} publisher${assigned > 1 ? 's' : ''}!`)
      setTimeout(() => setSuccess(""), 5000)
    }
    if (failed > 0) {
      setError(`Failed to assign ${failed} publisher${failed > 1 ? 's' : ''}`)
      setTimeout(() => setError(""), 5000)
    }
  }

  const unassignAllPublishers = async () => {
    if (!selectedSubscriberId || processing) return
    setProcessing(true)
    setError("")
    setSuccess("")
    
    let unassigned = 0
    let failed = 0

    for (const perm of subscriberPermissions) {
      try {
        await deleteStreamPermission(perm.id!)
        unassigned++
      } catch (e) {
        failed++
      }
    }

    setProcessing(false)
    if (unassigned > 0) {
      setSuccess(`Successfully unassigned ${unassigned} publisher${unassigned > 1 ? 's' : ''}!`)
      setTimeout(() => setSuccess(""), 5000)
    }
    if (failed > 0) {
      setError(`Failed to unassign ${failed} publisher${failed > 1 ? 's' : ''}`)
      setTimeout(() => setError(""), 5000)
    }
  }

  const setPermissionBit = async (publisherId: string, key: "allowVideo" | "allowAudio", value: boolean) => {
    const existing = subscriberPermissions.find((p) => p.publisherId === publisherId)
    if (!existing) return
    try {
      await updateStreamPermission(existing.id!, { [key]: value } as any)
    } catch (e: any) {
      setError(e?.message || "Update failed")
      setTimeout(() => setError(""), 3000)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-lg text-muted-foreground">Loading subscribers and publishers...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Alert */}
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          <strong>Subscriber Assignments:</strong> Select a subscriber from the list below, then assign or unassign publishers. 
          Use the bulk action buttons to quickly assign or unassign all publishers at once.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Subscriber List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Subscribers ({subscribers.length})</CardTitle>
            <CardDescription>Select a subscriber</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              placeholder="Search by name or email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
              <div className="space-y-2 pr-4">
                {filteredSubscribers.map((s) => {
                  const isSelected = selectedSubscriberId === s.id
                  return (
                    <button
                      key={s.id}
                      className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary shadow-md" 
                          : "hover:bg-muted hover:border-muted-foreground/20"
                      }`}
                      onClick={() => setSelectedSubscriberId(s.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">
                            {s.displayName || s.email}
                          </div>
                          <div className="text-xs opacity-80 truncate mt-0.5">
                            {s.email}
                          </div>
                        </div>
                        {s.isActive && (
                          <Badge variant={isSelected ? "secondary" : "outline"} className="text-xs shrink-0">
                            Active
                          </Badge>
                        )}
                      </div>
                    </button>
                  )
                })}
                {filteredSubscribers.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No subscribers found
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Publisher Assignment */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl">Assign Publishers</CardTitle>
                {selectedSubscriber && (
                  <CardDescription className="text-base">
                    Managing: <strong>{selectedSubscriber.displayName || selectedSubscriber.email}</strong>
                    <br />
                    <span className="text-sm">
                      {assignedCount} of {totalPublishers} publishers assigned
                    </span>
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={assignAllPublishers}
                  disabled={processing || assignedCount === totalPublishers}
                  variant="default"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign All
                </Button>
                <Button
                  onClick={unassignAllPublishers}
                  disabled={processing || assignedCount === 0}
                  variant="outline"
                  size="sm"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Unassign All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 text-green-700 bg-green-50">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Publisher List */}
            <ScrollArea className="h-[calc(100vh-460px)] min-h-[400px]">
              <div className="space-y-2 pr-4">
                {publishers.map((p) => {
                  const assigned = assignedPublisherIds.has(p.id)
                  const perm = subscriberPermissions.find((sp) => sp.publisherId === p.id)
                  return (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        assigned 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" 
                          : "bg-card hover:bg-muted/50"
                      }`}
                    >
                      {/* Publisher Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          {assigned ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {p.displayName || p.email}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.email}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 ml-4">
                        {/* Video/Audio Toggle */}
                        {assigned && (
                          <div className="flex items-center gap-2 border-r pr-3">
                            <button
                              className={`p-2 rounded transition-colors ${
                                perm?.allowVideo 
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                              }`}
                              onClick={() => setPermissionBit(p.id, "allowVideo", !perm?.allowVideo)}
                              title={perm?.allowVideo ? "Video enabled" : "Video disabled"}
                            >
                              <Video className="h-4 w-4" />
                            </button>
                            <button
                              className={`p-2 rounded transition-colors ${
                                perm?.allowAudio 
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                              }`}
                              onClick={() => setPermissionBit(p.id, "allowAudio", !perm?.allowAudio)}
                              title={perm?.allowAudio ? "Audio enabled" : "Audio disabled"}
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {/* Assign/Unassign Button */}
                        <Button
                          variant={assigned ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleAssignment(p.id, !assigned)}
                        >
                          {assigned ? "Unassign" : "Assign"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {publishers.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No publishers available
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
