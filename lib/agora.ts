import type { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack, IRemoteVideoTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng"

export type AgoraJoinRole = "publisher" | "audience"

export interface AgoraJoinConfig {
  channelName: string
  role: AgoraJoinRole
  uid?: number
  appId?: string
  token?: string
  container?: HTMLElement
  width?: string | number
  height?: string | number
  streamType?: "system_audio" | "microphone"
}

export class AgoraManager {
  private client: IAgoraRTCClient | null = null
  private localAudio: ILocalAudioTrack | null = null
  private localVideo: ILocalVideoTrack | null = null
  private screenTrack: ILocalVideoTrack | null = null

  private async getAgora() {
    if (typeof window === "undefined") throw new Error("Agora can only be used in the browser")
    const mod = await import("agora-rtc-sdk-ng")
    try { 
      (mod.default as any).setLogLevel(4)
    } catch {}
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

    const AgoraRTC = await this.getAgora()
    
    this.client = AgoraRTC.createClient({ 
      mode: "live",
      codec: "vp8"
    })
    
    if ((this.client as any).setLatencyLevel) {
      (this.client as any).setLatencyLevel(1)
    }

    await this.client.setClientRole(role === "publisher" ? "host" : "audience")

    if ((this.client as any).setAudioProfile) {
      (this.client as any).setAudioProfile("speech_low_latency")
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
      this.client.on("user-published", async (user, mediaType) => {
        if (mediaType === "audio") {
          await this.client!.subscribe(user, mediaType)
          const remoteAudioTrack = user.audioTrack as IRemoteAudioTrack
          remoteAudioTrack.setPlaybackDevice("default")
          remoteAudioTrack.setVolume(100)
          remoteAudioTrack.play()
          if ((remoteAudioTrack as any).setAudioLatencyHint) {
            (remoteAudioTrack as any).setAudioLatencyHint("playback")
          }
        }
      })

      this.client.on("user-unpublished", (user) => {
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
    
    let audioTrack: ILocalAudioTrack | null = null
    
    try {
      const screenTracks = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "480p_1",
          optimizationMode: "motion" as const,
          screenSourceType: fullScreen ? ("screen" as const) : ("window" as const),
        },
        withSystemAudio ? "auto" : "disable"
      )
      
      if (Array.isArray(screenTracks)) {
        this.screenTrack = screenTracks[0]
        audioTrack = screenTracks[1]
        
        if (audioTrack) {
          await this.configureUltraLowLatencyAudio(audioTrack)
          await this.client.publish([audioTrack])
        }
      } else {
        this.screenTrack = screenTracks
        audioTrack = await this.createUltraLowLatencyMicrophoneTrack(AgoraRTC)
        await this.client.publish([audioTrack])
      }
    } catch (error) {
      console.warn("Screen share failed, falling back to microphone:", error)
      audioTrack = await this.createUltraLowLatencyMicrophoneTrack(AgoraRTC)
      await this.client.publish([audioTrack])
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
    if (this.localAudio) return

    const AgoraRTC = await this.getAgora()
    try {
      this.localAudio = await this.createUltraLowLatencyMicrophoneTrack(AgoraRTC)
      await this.client.publish([this.localAudio])
    } catch (error) {
      console.error("Failed to start microphone:", error)
      throw error
    }
  }

  private async configureUltraLowLatencyAudio(audioTrack: ILocalAudioTrack) {
    if (audioTrack.setEncoderConfiguration) {
      audioTrack.setEncoderConfiguration({
        sampleRate: 8000,
        stereo: false,
        bitrate: 8,
      })
    }
    
    if ((audioTrack as any).setAudioLatencyHint) {
      (audioTrack as any).setAudioLatencyHint("interactive")
    }
  }

  private async createUltraLowLatencyMicrophoneTrack(AgoraRTC: any): Promise<ILocalAudioTrack> {
    const track = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: {
        sampleRate: 8000,
        stereo: false,
        bitrate: 8,
      },
      AEC: false,
      ANS: false,
      AGC: false,
    })
    
    await this.configureUltraLowLatencyAudio(track)
    
    return track
  }

  async enableMic() {
    if (!this.client) throw new Error("Client not joined")
    if (!this.localAudio) {
      const AgoraRTC = await this.getAgora()
      this.localAudio = await this.createUltraLowLatencyMicrophoneTrack(AgoraRTC)
      await this.client.publish([this.localAudio])
    } else {
      await this.localAudio.setEnabled(true)
      try {
        await this.client.publish([this.localAudio])
      } catch {}
    }
  }

  async disableMic() {
    if (!this.client || !this.localAudio) return
    try {
      await this.localAudio.setEnabled(false)
      await this.client.unpublish([this.localAudio])
    } catch {}
  }
}

export const agoraManager = new AgoraManager()