"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { getUsersByRole, createStreamPermission, deleteStreamPermission, updateStreamPermission, type StreamPermission } from "@/lib/admin"
import type { UserProfile } from "@/lib/auth"
import { permissionsManager } from "@/lib/permissions"
import { CheckCircle2, Circle, Users, UserPlus, UserMinus, Video, Volume2, CheckSquare, Square } from "lucide-react"

export function SubscriberAssignments() {
  const [subscribers, setSubscribers] = useState<(UserProfile & { id: string })[]>([])
  const [publishers, setPublishers] = useState<(UserProfile & { id: string })[]>([])
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string>("")
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<Set<string>>(new Set())
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

  const toggleSubscriberSelection = (subscriberId: string) => {
    const newSet = new Set(selectedSubscriberIds)
    if (newSet.has(subscriberId)) {
      newSet.delete(subscriberId)
    } else {
      newSet.add(subscriberId)
    }
    setSelectedSubscriberIds(newSet)
  }

  const selectAllSubscribers = () => {
    const allIds = filteredSubscribers.map(s => s.id)
    setSelectedSubscriberIds(new Set(allIds))
  }

  const deselectAllSubscribers = () => {
    setSelectedSubscriberIds(new Set())
  }

  const allFilteredSelected = filteredSubscribers.length > 0 && filteredSubscribers.every(s => selectedSubscriberIds.has(s.id))

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

  const bulkAssignToSelectedSubscribers = async () => {
    if (selectedSubscriberIds.size === 0 || processing) return
    
    const confirmed = confirm(
      `Are you sure you want to assign ALL publishers to ${selectedSubscriberIds.size} selected subscriber${selectedSubscriberIds.size > 1 ? 's' : ''}?\n\nThis will create ${publishers.length * selectedSubscriberIds.size} assignment${publishers.length * selectedSubscriberIds.size > 1 ? 's' : ''} (skipping any that already exist).`
    )
    if (!confirmed) return

    setProcessing(true)
    setError("")
    setSuccess("")
    
    let totalAssigned = 0
    let totalSkipped = 0
    let totalFailed = 0

    for (const subscriberId of Array.from(selectedSubscriberIds)) {
      for (const publisher of publishers) {
        try {
          await createStreamPermission({
            publisherId: publisher.id,
            subscriberId: subscriberId,
            allowVideo: true,
            allowAudio: true,
            isActive: true,
          })
          totalAssigned++
        } catch (e: any) {
          // If permission already exists, it's okay, just skip
          if (e?.message?.includes('already exists') || e?.code === 'already-exists') {
            totalSkipped++
          } else {
            totalFailed++
          }
        }
      }
    }

    setProcessing(false)
    
    const messages = []
    if (totalAssigned > 0) {
      messages.push(`Created ${totalAssigned} new assignment${totalAssigned > 1 ? 's' : ''}`)
    }
    if (totalSkipped > 0) {
      messages.push(`Skipped ${totalSkipped} existing`)
    }
    if (totalFailed > 0) {
      messages.push(`Failed ${totalFailed}`)
    }
    
    if (messages.length > 0) {
      const message = messages.join(', ') + ` across ${selectedSubscriberIds.size} subscriber${selectedSubscriberIds.size > 1 ? 's' : ''}!`
      if (totalFailed > 0) {
        setError(message)
        setTimeout(() => setError(""), 7000)
      } else {
        setSuccess(message)
        setTimeout(() => setSuccess(""), 7000)
      }
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
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Subscribers</p>
                <h3 className="text-3xl font-bold mt-2">{subscribers.length}</h3>
              </div>
              <Users className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Publishers</p>
                <h3 className="text-3xl font-bold mt-2">{publishers.length}</h3>
              </div>
              <Video className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected</p>
                <h3 className="text-3xl font-bold mt-2">{selectedSubscriberIds.size}</h3>
              </div>
              <CheckSquare className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Users className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 dark:text-blue-200">
          <strong>Quick Guide:</strong> Use checkboxes to select multiple subscribers, then click "Assign All Publishers" for bulk assignment. 
          Or click a subscriber's name to manage their individual assignments.
        </AlertDescription>
      </Alert>

      {/* Bulk Actions Bar */}
      {selectedSubscriberIds.size > 0 && (
        <Card className="border-2 border-primary shadow-lg bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <CheckSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-primary">
                    {selectedSubscriberIds.size} Subscriber{selectedSubscriberIds.size > 1 ? 's' : ''} Selected
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Ready to assign {publishers.length} publisher{publishers.length > 1 ? 's' : ''} = {publishers.length * selectedSubscriberIds.size} total assignments
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={bulkAssignToSelectedSubscribers}
                  disabled={processing || publishers.length === 0}
                  variant="default"
                  size="lg"
                  className="flex-1 md:flex-none bg-primary hover:bg-primary/90 shadow-md"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign All Publishers
                    </>
                  )}
                </Button>
                <Button
                  onClick={deselectAllSubscribers}
                  variant="outline"
                  size="lg"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Subscriber List */}
        <Card className="lg:col-span-1 shadow-md">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Subscribers</CardTitle>
                <CardDescription className="text-xs">
                  {filteredSubscribers.length} of {subscribers.length} shown
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input 
              placeholder="🔍 Search subscribers..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 border-2"
            />
            
            {/* Select All Button */}
            {filteredSubscribers.length > 0 && (
              <Button
                variant={allFilteredSelected ? "default" : "outline"}
                size="sm"
                onClick={allFilteredSelected ? deselectAllSubscribers : selectAllSubscribers}
                className="w-full font-semibold"
              >
                {allFilteredSelected ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All ({filteredSubscribers.length})
                  </>
                )}
              </Button>
            )}
            
            <ScrollArea className="h-[calc(100vh-520px)] min-h-[350px]">
              <div className="space-y-2 pr-4">
                {filteredSubscribers.map((s) => {
                  const isSelected = selectedSubscriberId === s.id
                  const isChecked = selectedSubscriberIds.has(s.id)
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border-2 transition-all duration-200 ${
                        isSelected 
                          ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-primary shadow-lg scale-[1.02]" 
                          : isChecked
                          ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400 dark:from-blue-950/40 dark:to-blue-900/40 dark:border-blue-600 shadow-md"
                          : "hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted hover:border-muted-foreground/30 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Checkbox */}
                        <div 
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSubscriberSelection(s.id)
                          }}
                        >
                          <Checkbox 
                            checked={isChecked}
                            onCheckedChange={() => toggleSubscriberSelection(s.id)}
                            className={`h-5 w-5 ${isSelected ? "border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary" : ""}`}
                          />
                        </div>
                        
                        {/* Subscriber Info - Clickable */}
                        <button
                          className="flex-1 text-left min-w-0"
                          onClick={() => setSelectedSubscriberId(s.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">
                                {s.displayName || s.email}
                              </div>
                              <div className={`text-xs truncate mt-0.5 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                                {s.email}
                              </div>
                            </div>
                            {s.isActive && (
                              <Badge 
                                variant={isSelected ? "secondary" : "outline"} 
                                className={`text-xs shrink-0 ${isChecked && !isSelected ? 'bg-blue-200 text-blue-900 border-blue-300' : ''}`}
                              >
                                ● Active
                              </Badge>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  )
                })}
                {filteredSubscribers.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No subscribers found</p>
                    <p className="text-xs mt-1">Try adjusting your search</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Publisher Assignment */}
        <Card className="lg:col-span-3 shadow-md">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-b">
            <div className="flex flex-col md:flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/10 p-2 rounded-lg">
                    <Video className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardTitle className="text-xl">Publisher Assignments</CardTitle>
                </div>
                {selectedSubscriber && (
                  <div className="ml-11">
                    <p className="text-sm text-muted-foreground">Managing assignments for:</p>
                    <p className="font-bold text-lg text-primary">
                      {selectedSubscriber.displayName || selectedSubscriber.email}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium">{assignedCount} Assigned</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <span className="text-sm text-muted-foreground">{totalPublishers - assignedCount} Unassigned</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={assignAllPublishers}
                  disabled={processing || assignedCount === totalPublishers}
                  variant="default"
                  size="sm"
                  className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign All
                </Button>
                <Button
                  onClick={unassignAllPublishers}
                  disabled={processing || assignedCount === 0}
                  variant="destructive"
                  size="sm"
                  className="flex-1 md:flex-none"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* Status Messages */}
            {error && (
              <Alert variant="destructive" className="border-l-4 border-l-red-600">
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-600">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200 font-medium">{success}</AlertDescription>
              </Alert>
            )}

            {/* Publisher List */}
            <ScrollArea className="h-[calc(100vh-540px)] min-h-[350px]">
              <div className="space-y-3 pr-4">
                {publishers.map((p) => {
                  const assigned = assignedPublisherIds.has(p.id)
                  const perm = subscriberPermissions.find((sp) => sp.publisherId === p.id)
                  return (
                    <div 
                      key={p.id} 
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${
                        assigned 
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-700 shadow-sm" 
                          : "bg-card hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/50 hover:border-muted-foreground/40 hover:shadow-sm"
                      }`}
                    >
                      {/* Publisher Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="shrink-0">
                          {assigned ? (
                            <div className="bg-green-500 rounded-full p-1">
                              <CheckCircle2 className="h-5 w-5 text-white" />
                            </div>
                          ) : (
                            <div className="border-2 border-muted-foreground/30 rounded-full p-1">
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">
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
                          <div className="flex items-center gap-2 border-r-2 pr-3">
                            <button
                              className={`p-2.5 rounded-lg transition-all duration-200 ${
                                perm?.allowVideo 
                                  ? "bg-green-500 text-white shadow-md hover:bg-green-600" 
                                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 hover:bg-gray-300"
                              }`}
                              onClick={() => setPermissionBit(p.id, "allowVideo", !perm?.allowVideo)}
                              title={perm?.allowVideo ? "Video enabled" : "Video disabled"}
                            >
                              <Video className="h-4 w-4" />
                            </button>
                            <button
                              className={`p-2.5 rounded-lg transition-all duration-200 ${
                                perm?.allowAudio 
                                  ? "bg-green-500 text-white shadow-md hover:bg-green-600" 
                                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 hover:bg-gray-300"
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
                          className={`${assigned ? '' : 'bg-green-600 hover:bg-green-700'} font-semibold min-w-[100px]`}
                          onClick={() => toggleAssignment(p.id, !assigned)}
                        >
                          {assigned ? (
                            <>
                              <UserMinus className="h-4 w-4 mr-1" />
                              Remove
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {publishers.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="font-medium text-lg">No publishers available</p>
                    <p className="text-sm mt-2">Publishers will appear here once added</p>
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
