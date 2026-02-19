"use client"
import { useEffect, useRef } from "react";

export default function Receiver() {
  const wsRef = useRef<WebSocket | null>(null);
  const rtcRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://192.168.1.7:8080');
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    rtcRef.current = pc;

    pc.ondatachannel = (event) => {
      dcRef.current = event.channel;
      event.channel.onopen = () => console.log("Data Channel is LIVE");
    };

    const sendBinary = (data: ArrayBuffer) => {
      if (dcRef.current?.readyState === "open") {
        dcRef.current.send(data);
      }
    };

    // Keys that should be prevented from triggering browser behavior
    // Do NOT include Ctrl+C, Ctrl+Z etc. so your terminal still works
    const browserKeys = new Set([
      'F1','F3','F5','F7','F11','F12',
      'Tab', // prevent tab from switching browser focus
    ]);

    const getScaledCoords = (clientX: number, clientY: number) => {
      const video = remoteVideoRef.current;
      if (!video) return { x: clientX, y: clientY };
      const rect = video.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      return {
        x: Math.round(Math.max(0, relX * (video.videoWidth / rect.width))),
        y: Math.round(Math.max(0, relY * (video.videoHeight / rect.height))),
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getScaledCoords(e.clientX, e.clientY);
      const buffer = new ArrayBuffer(5);
      const view = new DataView(buffer);
      view.setUint8(0, 0);
      view.setUint16(1, x, true);
      view.setUint16(3, y, true);
      sendBinary(buffer);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Prevent browser from doing things like text selection on double click
      e.preventDefault();
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 1); // MouseDown
      view.setUint8(1, e.button === 0 ? 0 : e.button === 2 ? 1 : 2);
      sendBinary(buffer);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, 2); // MouseUp
      view.setUint8(1, e.button === 0 ? 0 : e.button === 2 ? 1 : 2);
      sendBinary(buffer);
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser right-click menu so right clicks reach remote
      e.preventDefault();
    };

    const encodeKey = (code: string): Uint8Array<ArrayBuffer> | null => {
      const encoder = new TextEncoder();
      const codeBytes = encoder.encode(code);
      if (codeBytes.length > 32) return null;
      const buf = new Uint8Array(new ArrayBuffer(2 + codeBytes.length));
      buf[1] = codeBytes.length;
      buf.set(codeBytes, 2);
      return buf;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only block keys that would break the browser UI
      if (browserKeys.has(e.code)) e.preventDefault();
      const payload = encodeKey(e.code);
      if (!payload) return;
      payload[0] = 3; // KeyDown
      sendBinary(payload.buffer as ArrayBuffer);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (browserKeys.has(e.code)) e.preventDefault();
      const payload = encodeKey(e.code);
      if (!payload) return;
      payload[0] = 4; // KeyUp
      sendBinary(payload.buffer as ArrayBuffer);
    };

    // CRITICAL: When window loses focus (e.g. Windows key opens Start Menu),
    // tell Go to release ALL held keys and mouse buttons so nothing gets stuck
    const handleBlur = () => {
      const buffer = new ArrayBuffer(1);
      new DataView(buffer).setUint8(0, 5); // ReleaseAll
      sendBinary(buffer);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    rtcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({ type: 'iceCandidate', candidate: event.candidate }));
      }
    };

    rtcRef.current.oniceconnectionstatechange = () => {
      console.log("ICE:", rtcRef.current?.iceConnectionState);
    };

    wsRef.current.onopen = () => {
      wsRef.current?.send(JSON.stringify({ type: 'reciever' }));
    };

    wsRef.current.onmessage = async (event: any) => {
      const message = JSON.parse(event.data);
      if (message.type === 'createOffer') {
        await rtcRef.current?.setRemoteDescription(message.candidate);
        const answer = await rtcRef.current?.createAnswer();
        await rtcRef.current?.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: 'createAnswer', candidate: answer }));
      } else if (message.type === 'iceCandidate') {
        await rtcRef.current?.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    };

    rtcRef.current.ontrack = (event) => {
      if (event.track.kind === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play().catch(console.error);
      }
    };

    return () => {
      handleBlur(); // release all keys on unmount too
      wsRef.current?.close();
      rtcRef.current?.close();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <div style={{
      margin: 0, padding: 0, background: '#000',
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          cursor: 'none', // hide browser cursor — remote cursor is in the video stream
        }}
        onClick={(e) => e.preventDefault()}
        onDoubleClick={(e) => e.preventDefault()}
      />
      <button
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 10,
          padding: '8px 16px', background: 'rgba(0,0,0,0.7)',
          color: 'white', border: '1px solid #555',
          borderRadius: 6, cursor: 'pointer',
        }}
        onClick={() => {
          if (!document.fullscreenElement) remoteVideoRef.current?.requestFullscreen();
          else document.exitFullscreen();
        }}
      >
        Fullscreen
      </button>
    </div>
  );
}