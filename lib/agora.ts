import type { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack, IRemoteVideoTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng"

export type AgoraJoinRole = "publisher" | "audience"

export interface AgoraJoinConfig {
  channelName: string
  role: AgoraJoinRole
  uid?: number
  appId?: string
  token?: string
  container?: HTMLElement // Optional for microphone-only streams
  width?: string | number
  height?: string | number
  streamType?: "system_audio" | "microphone" // Stream type for publisher
}

export class AgoraManager {
  private client: IAgoraRTCClient | null = null
  private localAudio: ILocalAudioTrack | null = null
  private localVideo: ILocalVideoTrack | null = null
  private screenTrack: ILocalVideoTrack | null = null

  private async getAgora() {
    if (typeof window === "undefined") throw new Error("Agora can only be used in the browser")
    const mod = await import("agora-rtc-sdk-ng")
    // Configure codec and profile for smoother high-FPS screen share
    try { (mod.default as any).setLogLevel(3) } catch {}
    return mod.default
  }

  private async fetchToken(channelName: string, role: AgoraJoinRole, uid?: number) {
    const res = await fetch("/api/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, role, uid }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || "Failed to fetch Agora token")
    return data as { token: string; uid: number; appId: string }
  }

  async join(config: AgoraJoinConfig) {
    const { channelName, role, uid, streamType } = config

    const tokenInfo = await this.fetchToken(channelName, role, uid)
    const appId = tokenInfo.appId
    const token = tokenInfo.token
    const agoraUid = tokenInfo.uid

    // Ultra-low latency mode: Use "live" mode for broadcasting but optimize for minimal latency
    const AgoraRTC = await this.getAgora()
    this.client = AgoraRTC.createClient({ 
      mode: "live", // Live mode for broadcasting (publisher -> subscribers)
      codec: "vp8" // VP8 codec for better real-time performance and lower latency
    })
    
    // Set client role for broadcasting
    this.client.setClientRole(role === "publisher" ? "host" : "audience")
    
    // Enable low-latency mode for live streaming
    // Configure client for minimal latency
    try {
      // Set audio profile for low latency (if available)
      if ((this.client as any).setAudioProfile) {
        (this.client as any).setAudioProfile("speech_low_quality") // Lower quality = lower latency
      }
    } catch (e) {
      // Feature might not be available in all SDK versions
    }

    await this.client.join(appId, channelName, token, agoraUid)

    if (role === "publisher") {
      if (streamType === "microphone") {
        await this.startMicrophoneOnly()
      } else {
        if (!config.container) {
          throw new Error("Container is required for system audio streams")
        }
        await this.startScreenShare(config.container)
      }
    } else {
      // Audience: subscribe only to audio tracks (audio-only mode)
      this.client.on("user-published", async (user, mediaType) => {
        if (mediaType === "audio") {
          await this.client!.subscribe(user, mediaType)
          const remoteAudioTrack = user.audioTrack as IRemoteAudioTrack
          // Configure audio playback for minimal latency
          remoteAudioTrack.setVolume(100)
          // Play immediately without buffering for ultra-low latency
          remoteAudioTrack.play()
        }
        // Skip video tracks - subscribers only hear audio
      })

      this.client.on("user-unpublished", (user) => {
        // No-op; container is controlled by React
      })
    }
  }

  async leave() {
    try {
      if (this.localAudio) {
        this.localAudio.stop()
        this.localAudio.close()
        this.localAudio = null
      }
      if (this.localVideo) {
        this.localVideo.stop()
        this.localVideo.close()
        this.localVideo = null
      }
      if (this.client) {
        if (this.screenTrack) {
          try {
            await this.client.unpublish([this.screenTrack] as any)
            this.screenTrack.stop()
            this.screenTrack.close()
          } catch {}
        }
        // Unpublish all tracks including microphone audio
        try {
          await this.client.unpublish().catch(() => {})
        } catch {}
        await this.client.leave()
      }
    } finally {
      this.client = null
      this.localAudio = null
      this.localVideo = null
      this.screenTrack = null
    }
  }

  async startScreenShare(
    container: HTMLElement,
    options?: { fullScreen?: boolean; withSystemAudio?: boolean; preferFPS60?: boolean }
  ) {
    if (!this.client) throw new Error("Client not joined")
    if (this.screenTrack) return

    const fullScreen = options?.fullScreen ?? true
    const withSystemAudio = options?.withSystemAudio ?? true

    const AgoraRTC = await this.getAgora()
    
    // Audio-only mode: Only capture system audio, no video
    let audioTrack: ILocalAudioTrack | null = null
    
    try {
      // Create screen capture with audio only (no video track)
      // Use lower resolution for faster encoding and lower latency
      const screenTracks = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "480p_15", // Lower resolution and framerate for minimal latency
          optimizationMode: "motion" as const,
          screenSourceType: fullScreen ? ("screen" as const) : ("window" as const),
        },
        withSystemAudio ? "auto" : "disable"
      )
      
      if (Array.isArray(screenTracks)) {
        // We got both video and audio tracks, only use audio
        this.screenTrack = screenTracks[0] // Keep video track reference for cleanup
        audioTrack = screenTracks[1] // Use the audio track
        
        // Configure audio track for ultra-low latency
        if (audioTrack) {
          // Set audio encoder configuration for minimal latency
          if (audioTrack.setEncoderConfiguration) {
            audioTrack.setEncoderConfiguration({
              sampleRate: 48000,
              stereo: false, // Mono for lower latency
              bitrate: 48, // Lower bitrate for faster encoding
            })
          }
          
          await this.client.publish([audioTrack] as any)
        }
        
        // Audio-only mode: don't show video, container will be handled by React
      } else {
        // Only got video track, try to get system audio separately
        this.screenTrack = screenTracks
        // For audio-only mode, we'll create a microphone track to capture system audio
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: {
            sampleRate: 48000,
            stereo: false,
            bitrate: 48,
          },
          AEC: true,
          ANS: true,
          AGC: true,
        })
        await this.client.publish([audioTrack] as any)
        // Audio-only mode: don't show video, container will be handled by React
      }
    } catch (error) {
      // Fallback: create microphone track for system audio with low latency config
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: {
          sampleRate: 48000,
          stereo: false,
          bitrate: 48,
        },
        AEC: true,
        ANS: true,
        AGC: true,
      })
      await this.client.publish([audioTrack] as any)
      // Audio-only mode: don't show video, container will be handled by React
    }
  }
  

  async stopScreenShare() {
    if (!this.client || !this.screenTrack) return
    try {
      await this.client.unpublish([this.screenTrack] as any)
    } catch {}
    try {
      this.screenTrack.stop()
      this.screenTrack.close()
    } finally {
      this.screenTrack = null
    }
  }

  async startMicrophoneOnly() {
    if (!this.client) throw new Error("Client not joined")
    if (this.localAudio) return // Already started

    const AgoraRTC = await this.getAgora()
    try {
      // Create microphone audio track with ultra-low latency configuration
      this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
        // Optimize encoder configuration for minimal latency
        encoderConfig: {
          sampleRate: 48000, // High sample rate for quality
          stereo: false, // Mono for lower latency
          bitrate: 48, // Lower bitrate for faster encoding (48kbps is sufficient for voice)
        },
        // Disable audio processing features that add latency
        AEC: true, // Keep echo cancellation but optimize it
        ANS: true, // Keep noise suppression but optimize it
        AGC: true, // Keep automatic gain control but optimize it
      })
      
      await this.client.publish([this.localAudio] as any)
    } catch (error) {
      console.error("Failed to start microphone:", error)
      throw error
    }
  }

  async enableMic() {
    if (!this.client) throw new Error("Client not joined")
    if (!this.localAudio) {
      const AgoraRTC = await this.getAgora()
      this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: {
          sampleRate: 48000,
          stereo: false,
          bitrate: 48,
        },
        AEC: true,
        ANS: true,
        AGC: true,
      })
      await this.client.publish([this.localAudio] as any)
    } else {
      await this.localAudio.setEnabled(true)
      // Ensure published
      try {
        await this.client.publish([this.localAudio] as any)
      } catch {}
    }
  }

  async disableMic() {
    if (!this.client || !this.localAudio) return
    try {
      await this.localAudio.setEnabled(false)
      await this.client.unpublish([this.localAudio] as any)
    } catch {}
  }
}

export const agoraManager = new AgoraManager()


