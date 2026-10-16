
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import Setting from "../components/Setting";
import {
  Settings,
  ArrowLeft,
  Mic,
  Square,
  Send,
  Trash2,
  Phone,
  PhoneOff,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Chat = ({ user, setUser }) => {
  // Chat state
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Voice-message state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");

  // Call state
  const [callStatus, setCallStatus] = useState("idle");
  const [callType, setCallType] = useState("audio");
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [callMessage, setCallMessage] = useState("");

  // Refs
  const socket = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const currentChatRef = useRef(currentChat);
  const callTargetRef = useRef(null);
  const callStatusRef = useRef("idle");
  const callTypeRef = useRef("audio");

  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  const updateCallStatus = (status) => {
    callStatusRef.current = status;
    setCallStatus(status);
  };

  const updateCallType = (type) => {
    callTypeRef.current = type;
    setCallType(type);
  };

  // =========================================
  // VOICE MESSAGES
  // =========================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      recordingStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          setAudioBlob(blob);
          setAudioPreview(URL.createObjectURL(blob));
        }

        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
      alert("Cannot access microphone. Allow microphone permission.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    setIsRecording(false);
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      };
      recorder.stop();
    } else {
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }

    setIsRecording(false);
    setAudioBlob(null);

    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview("");
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !currentChat) return;

    try {
      const receiverId = currentChat._id;
      const formData = new FormData();

      formData.append("sender", user._id);
      formData.append("receiver", receiverId);

      const extension = audioBlob.type.includes("ogg")
        ? "ogg"
        : audioBlob.type.includes("mp4")
          ? "m4a"
          : "webm";

      formData.append("audio", audioBlob, `voice.${extension}`);

      const response = await fetch(`${API_URL}/messages/voice`, {
        method: "POST",
        body: formData,
      });

      const message = await response.json();

      if (!response.ok) {
        throw new Error(message.message || "Failed to send voice message");
      }

      setMessages((prev) => [...prev, message]);

      socket.current?.emit("sendMessage", {
        senderId: user._id,
        receiverId,
        message,
        text: "",
      });

      if (audioPreview) URL.revokeObjectURL(audioPreview);
      setAudioBlob(null);
      setAudioPreview("");
    } catch (error) {
      console.error("Voice-message error:", error);
      alert(error.message || "Could not send voice message.");
    }
  };

  // =========================================
  // WEBRTC
  // =========================================

  const flushPendingCandidates = async () => {
    const pc = peerConnectionRef.current;

    if (!pc?.remoteDescription) return;

    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    }
  };

  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });

    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("iceCandidate", {
          targetUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // Audio element handles sound for both audio and video calls.
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }

      // Video element displays the other participant during video calls.
      if (callTypeRef.current === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updateCallStatus("connected");
        setCallMessage(
          callTypeRef.current === "video"
            ? "Video call connected"
            : "Voice call connected"
        );
      } else if (
        pc.connectionState === "failed" &&
        peerConnectionRef.current === pc
      ) {
        cleanupCall();
        setCallMessage("Connection failed. Check your network.");
      } else if (
        pc.connectionState === "disconnected" &&
        peerConnectionRef.current === pc
      ) {
        setCallMessage("Connection interrupted...");
      }
    };

    return pc;
  };

  const cleanupCall = () => {
    const pc = peerConnectionRef.current;

    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }

    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    callTargetRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOn(true);
    updateCallStatus("idle");
    updateCallType("audio");
  };

  // =========================================
  // START AUDIO OR VIDEO CALL
  // =========================================

  const startCall = async (type = "audio") => {
    if (!currentChat?._id || callStatusRef.current !== "idle") return;

    const receiverId = currentChat._id;

    callTargetRef.current = receiverId;
    updateCallType(type);
    updateCallStatus("calling");
    setCallMessage(
      type === "video" ? "Starting video call..." : "Calling..."
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      if (callStatusRef.current !== "calling") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;

      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsCameraOn(type === "video");

      const pc = createPeerConnection(receiverId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.current?.emit("callUser", {
        receiverId,
        offer: pc.localDescription,
        callerName: user.username || "User",
        callType: type,
      });
    } catch (error) {
      console.error("Could not start call:", error);
      cleanupCall();
      setCallMessage(
        error.name === "NotAllowedError"
          ? "Camera or microphone permission was denied."
          : "Could not start the call. Check your camera and microphone."
      );
    }
  };

  // =========================================
  // ACCEPT OR REJECT INCOMING CALL
  // =========================================

  const acceptCall = async () => {
    const offer = pendingOfferRef.current;
    const callerId = incomingCall?.callerId;
    const type = incomingCall?.callType || "audio";

    if (!offer || !callerId) return;

    updateCallType(type);
    updateCallStatus("calling");
    callTargetRef.current = callerId;
    setCallMessage(type === "video" ? "Connecting video..." : "Connecting...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      if (callStatusRef.current !== "calling") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;

      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsCameraOn(type === "video");

      const pc = createPeerConnection(callerId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.current?.emit("acceptCall", {
        callerId,
        answer: pc.localDescription,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error("Could not accept call:", error);
      cleanupCall();
      setCallMessage(
        error.name === "NotAllowedError"
          ? "Camera or microphone permission was denied."
          : "Could not accept the call."
      );
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socket.current?.emit("rejectCall", {
        callerId: incomingCall.callerId,
      });
    }

    cleanupCall();
    setCallMessage("Call rejected.");
  };

  const endCall = () => {
    const targetUserId = callTargetRef.current;

    if (targetUserId) {
      socket.current?.emit("endCall", { targetUserId });
    }

    cleanupCall();
    setCallMessage("Call ended.");
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const nextMuted = !isMuted;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream || callTypeRef.current !== "video") return;

    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;

    const nextCameraOn = !videoTracks[0].enabled;

    videoTracks.forEach((track) => {
      track.enabled = nextCameraOn;
    });

    setIsCameraOn(nextCameraOn);
  };

  // =========================================
  // SOCKET.IO
  // =========================================

  useEffect(() => {
    if (!user?._id) return;

    const s = io(API_URL);
    socket.current = s;
    s.emit("addUser", user._id);

    const handleGetMessage = ({ senderId, message, text }) => {
      if (String(senderId) !== String(currentChatRef.current?._id)) return;

      const incomingMessage = message || {
        sender: senderId,
        text,
        type: "text",
      };

      setMessages((prev) => {
        if (
          incomingMessage._id &&
          prev.some((m) => m._id === incomingMessage._id)
        ) {
          return prev;
        }

        return [...prev, incomingMessage];
      });
    };

    const handleGetUsers = (onlineIds) => setOnlineUsers(onlineIds);

    const handleIncomingCall = ({
      callerId,
      callerName,
      offer,
      callType: incomingType,
    }) => {
      if (callStatusRef.current !== "idle") {
        s.emit("rejectCall", { callerId });
        return;
      }

      const type = incomingType === "video" ? "video" : "audio";

      pendingOfferRef.current = offer;
      callTargetRef.current = callerId;

      setIncomingCall({
        callerId,
        callerName,
        offer,
        callType: type,
      });

      updateCallType(type);
      updateCallStatus("incoming");
      setCallMessage(`${callerName || "Someone"} is calling...`);
    };

    const handleCallAccepted = async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates();
        setCallMessage("Connecting...");
      } catch (error) {
        console.error("Call setup error:", error);
        cleanupCall();
        setCallMessage("Failed to establish the call.");
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;

      const pc = peerConnectionRef.current;

      if (!pc?.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    };

    const handleCallRejected = () => {
      cleanupCall();
      setCallMessage("Call rejected.");
    };

    const handleCallUnavailable = ({ message }) => {
      cleanupCall();
      setCallMessage(message || "This user is offline.");
    };

    const handleCallEnded = () => {
      cleanupCall();
      setCallMessage("The other user ended the call.");
    };

    s.on("getMessage", handleGetMessage);
    s.on("getUsers", handleGetUsers);
    s.on("incomingCall", handleIncomingCall);
    s.on("callAccepted", handleCallAccepted);
    s.on("iceCandidate", handleIceCandidate);
    s.on("callRejected", handleCallRejected);
    s.on("callUnavailable", handleCallUnavailable);
    s.on("callEnded", handleCallEnded);

    return () => {
      s.off("getMessage", handleGetMessage);
      s.off("getUsers", handleGetUsers);
      s.off("incomingCall", handleIncomingCall);
      s.off("callAccepted", handleCallAccepted);
      s.off("iceCandidate", handleIceCandidate);
      s.off("callRejected", handleCallRejected);
      s.off("callUnavailable", handleCallUnavailable);
      s.off("callEnded", handleCallEnded);

      s.disconnect();

      if (socket.current === s) socket.current = null;

      const pc = peerConnectionRef.current;
      if (pc) pc.close();

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [user?._id]);

  // =========================================
  // LOAD USERS AND CHAT HISTORY
  // =========================================

  useEffect(() => {
    if (!user?._id) return;

    fetch(`${API_URL}/users`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load users");
        return res.json();
      })
      .then((data) => setUsers(data.filter((u) => u._id !== user._id)))
      .catch((error) => console.error("Load users error:", error));
  }, [user?._id]);

  useEffect(() => {
    if (!currentChat?._id || !user?._id) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    fetch(`${API_URL}/messages/${user._id}/${currentChat._id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load messages");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setMessages(Array.isArray(data) ? data : []);
      })
      .catch((error) => console.error("Load messages error:", error));

    return () => {
      cancelled = true;
    };
  }, [currentChat?._id, user?._id]);

  // =========================================
  // SEND TEXT MESSAGE
  // =========================================

  const sendMessage = async () => {
    const messageText = text.trim();
    if (!messageText || !currentChat?._id) return;

    try {
      const receiverId = currentChat._id;

      const response = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: user._id,
          receiver: receiverId,
          text: messageText,
        }),
      });

      const savedMessage = await response.json();

      if (!response.ok) {
        throw new Error(savedMessage.message || "Failed to send message");
      }

      setMessages((prev) => [...prev, savedMessage]);

      socket.current?.emit("sendMessage", {
        senderId: user._id,
        receiverId,
        text: messageText,
      });

      setText("");
    } catch (error) {
      console.error("Send message error:", error);
      alert(error.message || "Could not send message.");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (audioPreview) URL.revokeObjectURL(audioPreview);
    };
  }, [audioPreview]);

  // =========================================
  // SETTINGS
  // =========================================

  if (showSettings) {
    return (
      <div>
        <button
          onClick={() => setShowSettings(false)}
          className="flex items-center gap-2 p-3 font-semibold text-purple-600"
        >
          <ArrowLeft size={20} />
          Back to Chat
        </button>
        <Setting user={user} setUser={setUser} />
      </div>
    );
  }

  // =========================================
  // CHAT UI
  // =========================================

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`absolute inset-y-0 left-0 z-10 flex w-64 flex-col bg-red-200 transition-transform duration-300 md:relative md:w-1/4 md:translate-x-0 ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-between border-b p-4 text-lg font-bold">
          <h2>Users</h2>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 hover:bg-red-300"
            title="Profile settings"
          >
            <Settings size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto p-2">
          {users.map((u) => {
            const isOnline = onlineUsers.includes(u._id);

            return (
              <button
                key={u._id}
                onClick={() => {
                  setCurrentChat(u);
                  setShowSidebar(false);
                }}
                className={`flex items-center gap-3 rounded p-2 text-left hover:bg-gray-200 ${
                  currentChat?._id === u._id ? "bg-red-300" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={u.avatar}
                    alt={u.username}
                    className="h-12 w-12 rounded-full border-2 border-purple-600 object-cover"
                  />
                  <span
                    className={`absolute right-0 top-0 h-3 w-3 rounded-full border border-white ${
                      isOnline ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {u.username}
                  </span>
                  <span className="text-xs text-gray-600">
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat panel */}
      <main className="flex min-w-0 flex-1 flex-col bg-blue-300">
        {currentChat ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-blue-400 p-4">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="mr-1 text-purple-700 md:hidden"
                  aria-label="Back to users"
                >
                  <ArrowLeft size={21} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">
                    {currentChat.username}
                  </h2>
                  <span
                    className={`text-sm ${
                      onlineUsers.includes(currentChat._id)
                        ? "text-green-800"
                        : "text-gray-600"
                    }`}
                  >
                    {onlineUsers.includes(currentChat._id) ? "Online" : "Offline"}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Voice call */}
                <button
                  type="button"
                  onClick={() => startCall("audio")}
                  disabled={callStatus !== "idle"}
                  title="Voice call"
                  aria-label="Start voice call"
                  className="rounded-full bg-green-600 p-3 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Phone size={20} />
                </button>

                {/* Video call */}
                <button
                  type="button"
                  onClick={() => startCall("video")}
                  disabled={callStatus !== "idle"}
                  title="Video call"
                  aria-label="Start video call"
                  className="rounded-full bg-blue-700 p-3 text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <Video size={20} />
                </button>
              </div>
            </header>

            {/* Messages */}
            <section className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m, i) => {
                const senderId =
                  typeof m.sender === "object" ? m.sender?._id : m.sender;

                const isOwnMessage =
                  String(senderId) === String(user._id);

                return (
                  <div
                    key={m._id || i}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] break-words rounded-lg p-2 sm:max-w-md ${
                        isOwnMessage
                          ? "bg-purple-600 text-white"
                          : "bg-gray-300 text-black"
                      }`}
                    >
                      {m.type === "voice" ? (
                        <audio
                          controls
                          preload="metadata"
                          src={
                            m.audioUrl?.startsWith("http")
                              ? m.audioUrl
                              : `${API_URL}${m.audioUrl || ""}`
                          }
                          className="max-w-full"
                        />
                      ) : (
                        <span>{m.text}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </section>

            {/* Composer */}
            <footer className="flex flex-wrap items-center gap-2 border-t border-blue-400 p-3 sm:p-4">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                className="min-w-0 flex-1 rounded border border-gray-300 p-2"
                placeholder="Type a message..."
              />

              <button
                type="button"
                onClick={sendMessage}
                className="rounded bg-purple-600 p-2 text-white hover:bg-purple-700"
                title="Send message"
              >
                <Send size={20} />
              </button>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  title="Record voice message"
                  className="rounded p-2 hover:bg-blue-400"
                >
                  <Mic size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  title="Stop recording"
                  className="flex items-center gap-1 rounded p-2 text-red-700 hover:bg-blue-400"
                >
                  <Square size={20} />
                  Stop
                </button>
              )}

              {audioPreview && (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <audio controls src={audioPreview} className="max-w-full" />
                  <button
                    type="button"
                    onClick={sendVoiceMessage}
                    className="flex items-center gap-1 rounded bg-purple-600 p-2 text-white"
                  >
                    <Send size={18} />
                    Send voice
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="flex items-center gap-1 rounded bg-red-600 p-2 text-white"
                  >
                    <Trash2 size={18} />
                    Cancel
                  </button>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-600">
            Select a user to chat
          </div>
        )}
      </main>

      {/* Remote audio for voice calls and remote sound during video calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Video-call window */}
      {callStatus !== "idle" && callType === "video" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/95 p-3 text-white sm:p-6">
          <div className="w-full max-w-5xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  Video call with{" "}
                  {incomingCall?.callerName || currentChat?.username || "User"}
                </h2>
                <p className="text-sm text-slate-300">{callMessage}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-sm">
                {callStatus === "connected" ? "Connected" : "Connecting"}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-contain"
              />

              {callStatus !== "connected" && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-300">
                  Waiting for the other person's video...
                </div>
              )}

              <div className="absolute bottom-3 right-3 w-1/3 max-w-[200px] overflow-hidden rounded-xl border border-white/30 bg-slate-800 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-xs">
                    Camera off
                  </div>
                )}
                <span className="absolute bottom-1 left-2 text-xs">You</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
                className={`rounded-full p-4 ${
                  isMuted ? "bg-amber-600" : "bg-slate-700"
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                title={isCameraOn ? "Turn camera off" : "Turn camera on"}
                className={`rounded-full p-4 ${
                  isCameraOn ? "bg-slate-700" : "bg-amber-600"
                }`}
              >
                {isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
              </button>

              <button
                type="button"
                onClick={endCall}
                title="End video call"
                className="rounded-full bg-red-600 p-4 hover:bg-red-700"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice-call status and controls */}
      {callStatus !== "idle" && callType === "audio" && (
        <div className="fixed bottom-5 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-lg">
          <p>{callMessage}</p>
          <div className="mt-3 flex justify-center gap-3">
            {callStatus === "connected" && (
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
                className={`rounded-full p-3 ${
                  isMuted ? "bg-amber-600" : "bg-gray-700"
                }`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              title="End call"
              className="rounded-full bg-red-600 p-3 hover:bg-red-700"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Incoming call dialog */}
      {incomingCall && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-gray-900 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              {incomingCall.callType === "video" ? (
                <Video size={28} className="text-green-700" />
              ) : (
                <Phone size={28} className="text-green-700" />
              )}
            </div>

            <h2 className="text-xl font-semibold">
              Incoming {incomingCall.callType === "video" ? "video" : "voice"} call
            </h2>

            <p className="mt-2 text-gray-600">
              {incomingCall.callerName || "Someone"} is calling you.
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                onClick={rejectCall}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-white hover:bg-red-700"
              >
                <PhoneOff size={18} />
                Reject
              </button>

              <button
                type="button"
                onClick={acceptCall}
                className="flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-white hover:bg-green-700"
              >
                {incomingCall.callType === "video" ? (
                  <Video size={18} />
                ) : (
                  <Phone size={18} />
                )}
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finished-call message */}
      {callStatus === "idle" && callMessage && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-lg">
          <span>{callMessage}</span>
          <button
            type="button"
            onClick={() => setCallMessage("")}
            className="text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default Chat;
