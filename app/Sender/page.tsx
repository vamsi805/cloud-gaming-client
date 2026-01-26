"use client"
import { useEffect ,useRef} from "react";


export default function Sender() {
 const wsRef  = useRef<WebSocket|null>(null);
 const rtcRef = useRef<RTCPeerConnection|null>(null);
  const localVideoRef = useRef<HTMLVideoElement|null>(null);
   useEffect(()=>{
     wsRef.current = new WebSocket('ws://192.168.1.6:8080')
 
 wsRef.current.onopen= () =>{
   wsRef.current?.send(JSON.stringify({Type : 'sender'}));
 };
 wsRef.current.onmessage = (event:any) =>{
  const message = JSON.parse(event.data);
  if(message.Type === 'createAnswer'){
    console.log("Got answer");
    rtcRef.current?.setRemoteDescription(message.sdp);
  }
  else if(message.Type === 'iceCandidate'){
    rtcRef.current?.addIceCandidate(new RTCIceCandidate(message.candidate));
  }

 }
 return(()=>{wsRef.current?.close();
    rtcRef.current?.close();
 });
   },[])
 

async function initconnection(){
  rtcRef.current = new RTCPeerConnection();
  const pc = rtcRef.current
  const ws = wsRef.current;
  pc.onnegotiationneeded = async () =>{
 const offer = await pc.createOffer();
  pc.setLocalDescription(offer);
  ws?.send(JSON.stringify({Type :'createOffer', sdp : offer})); 
  }

   pc.onicecandidate = (event)=>{
        if(event.candidate){
          ws?.send(JSON.stringify({Type:'iceCandidate', candidate:event.candidate}));
        }
      }
 await startMedia();
}

const startMedia =async ()=>{
try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Add tracks to the connection
        stream.getTracks().forEach((track) => {
          rtcRef.current?.addTrack(track, stream);
        });

        // Attach to video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Error accessing media:", e);
      }
}

  return (
   <div>
    <h1>Sender</h1>
    <button onClick={initconnection}>Start</button>
    <video ref={localVideoRef} autoPlay playsInline muted></video>
   </div>
  );
}
