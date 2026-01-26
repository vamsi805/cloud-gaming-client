"use client"
import { useEffect,useRef } from "react";

export default function Reciever() {
const wsRef  = useRef<WebSocket|null>(null);
 const rtcRef = useRef<RTCPeerConnection|null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement|null>(null);
   useEffect(()=>{
     wsRef.current = new WebSocket('ws://192.168.1.6:8080')
     rtcRef.current = new RTCPeerConnection();
     rtcRef.current.onicecandidate = (event) => {if (event.candidate) {
                wsRef.current?.send(JSON.stringify({ Type: 'iceCandidate', candidate: event.candidate }));
            }}
 wsRef.current.onopen= () =>{
   wsRef.current?.send(JSON.stringify({Type : 'reciever'}));
 };
 wsRef.current.onmessage = async (event:any) =>{
  console.log(event.data)
  const message = JSON.parse(event.data);
  if(message.Type === 'createOffer'){
    rtcRef.current?.setRemoteDescription(message.sdp);
    const answer = await rtcRef.current?.createAnswer();
    rtcRef.current?.setLocalDescription(answer);
    wsRef.current?.send(JSON.stringify({Type :'createAnswer',sdp:answer}));
  }
  else if(message.Type === 'iceCandidate'){
    rtcRef.current?.addIceCandidate(new RTCIceCandidate(message.candidate));
  }

 }
 rtcRef.current.ontrack = (event) =>{
if (remoteVideoRef.current) {
  console.log("TRACK DETECTED")
  console.log(event);
   const [remoteStream] = event.streams;
    remoteVideoRef.current.srcObject = remoteStream
    const v = remoteVideoRef.current as HTMLVideoElement;
    v.muted = true; // or keep it muted in JSX for autoplay
}
 }
 return(()=>{wsRef.current?.close();
    rtcRef.current?.close();
 });
   },[])
 
  return (
   <div>
    <h1>Reciever</h1>
    <video ref={remoteVideoRef} autoPlay playsInline></video>
   </div>
  );
}
