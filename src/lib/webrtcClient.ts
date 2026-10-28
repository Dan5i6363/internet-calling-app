export interface WebRTCDiagnostics {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number;
  packetLossPercent: number;
  bitrateKbps: number;
  localCandidateType: string;
  remoteCandidateType: string;
  codec: string;
}

export interface WebRTCClientOptions {
  iceServers: RTCIceServer[];
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDiagnosticsUpdate?: (diag: WebRTCDiagnostics) => void;
}

export class WebRTCClient {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private options: WebRTCClientOptions;
  private isMuted = false;
  private statsInterval: any = null;
  private lastBytesReceived = 0;
  private lastStatsTimestamp = 0;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  constructor(options: WebRTCClientOptions) {
    this.options = options;
  }

  async initializePeerConnection(): Promise<RTCPeerConnection> {
    this.close();

    this.pc = new RTCPeerConnection({
      iceServers: this.options.iceServers,
      iceCandidatePoolSize: 2,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onIceCandidate(event.candidate);
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.options.onRemoteStream(event.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.options.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      // Diagnostic hook
    };

    // Acquire microphone
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream.getTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      throw new Error(`Microphone permission denied or device not found: ${err.message}`);
    }

    this.startDiagnostics();
    return this.pc;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.drainIceCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.drainIceCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    if (!this.pc.remoteDescription) {
      this.iceCandidateQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Failed to add ICE candidate:', err);
    }
  }

  private async drainIceCandidates(): Promise<void> {
    if (!this.pc) return;
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Failed to add queued ICE candidate:', err);
        }
      }
    }
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  getMutedState(): boolean {
    return this.isMuted;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private startDiagnostics() {
    this.statsInterval = setInterval(async () => {
      if (!this.pc || !this.options.onDiagnosticsUpdate) return;
      try {
        const stats = await this.pc.getStats();
        let rttMs: number | null = null;
        let jitterMs: number | null = null;
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let localCandidateType = 'unknown';
        let remoteCandidateType = 'unknown';
        let codec = 'OPUS';

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
          if (report.type === 'local-candidate' && report.candidateType) {
            localCandidateType = report.candidateType;
          }
          if (report.type === 'remote-candidate' && report.candidateType) {
            remoteCandidateType = report.candidateType;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.jitter !== undefined) {
              jitterMs = Math.round(report.jitter * 1000);
            }
            if (report.packetsLost !== undefined) {
              packetsLost = report.packetsLost;
            }
            if (report.packetsReceived !== undefined) {
              packetsReceived = report.packetsReceived;
            }
            if (report.bytesReceived !== undefined) {
              bytesReceived = report.bytesReceived;
            }
            if (report.codecId) {
              codec = report.mimeType || codec;
            }
          }
        });

        const now = Date.now();
        let bitrateKbps = 0;
        if (this.lastStatsTimestamp > 0 && bytesReceived >= this.lastBytesReceived) {
          const deltaSec = (now - this.lastStatsTimestamp) / 1000;
          if (deltaSec > 0) {
            bitrateKbps = Math.round(((bytesReceived - this.lastBytesReceived) * 8) / (deltaSec * 1000));
          }
        }
        this.lastBytesReceived = bytesReceived;
        this.lastStatsTimestamp = now;

        const totalPackets = packetsReceived + packetsLost;
        const packetLossPercent = totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 100) : 0;

        this.options.onDiagnosticsUpdate({
          connectionState: this.pc.connectionState,
          iceConnectionState: this.pc.iceConnectionState,
          iceGatheringState: this.pc.iceGatheringState,
          rttMs,
          jitterMs,
          packetsLost,
          packetLossPercent,
          bitrateKbps,
          localCandidateType,
          remoteCandidateType,
          codec: codec.replace('audio/', '').toUpperCase(),
        });
      } catch (err) {
        // Stats error ignore
      }
    }, 2000);
  }

  close() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.isMuted = false;
    this.lastBytesReceived = 0;
    this.lastStatsTimestamp = 0;
    this.iceCandidateQueue = [];
  }
}
