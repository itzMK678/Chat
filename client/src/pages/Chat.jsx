
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import Setting from "../components/Setting";
import { Settings, ArrowLeft, Mic, Square, Send, Trash2 } from "lucide-react";
const Chat = ({ user, setUser }) => {
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
const [isRecording, setIsRecording] = useState(false);
const [audioBlob, setAudioBlob] = useState(null);
const [audioPreview, setAudioPreview] = useState("");

const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);
  const socket = useRef();
const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        const recorder = new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(audioChunksRef.current, {
                type: recorder.mimeType || "audio/webm"
            });

            setAudioBlob(blob);
            setAudioPreview(URL.createObjectURL(blob));

            stream.getTracks().forEach((track) => track.stop());
        };

        recorder.start();
        setIsRecording(true);
    } catch (error) {
        console.error("Microphone error:", error);
        alert("Unable to access your microphone. Please allow microphone access.");
    }
};

const stopRecording = () => {
    if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
    ) {
        mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
};

const cancelRecording = () => {
    if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
    ) {
        mediaRecorderRef.current.onstop = () => {
            mediaRecorderRef.current?.stream
                ?.getTracks()
                .forEach((track) => track.stop());
        };

        mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setAudioBlob(null);

    if (audioPreview) {
        URL.revokeObjectURL(audioPreview);
    }

    setAudioPreview("");
};
const sendVoiceMessage = async () => {
    if (!audioBlob || !currentChat) return;

    try {
        const formData = new FormData();

        formData.append("sender", user._id);
        formData.append("receiver", currentChat._id);

        const extension = audioBlob.type.includes("ogg")
            ? "ogg"
            : audioBlob.type.includes("mp4")
                ? "m4a"
                : "webm";

        formData.append("audio", audioBlob, `voice.${extension}`);

        const response = await fetch(
            "http://localhost:5000/messages/voice",
            {
                method: "POST",
                body: formData
            }
        );

        const message = await response.json();

        if (!response.ok) {
            throw new Error(message.message || "Failed to send voice message");
        }

        setMessages((prev) => [...prev, message]);

        if (audioPreview) {
            URL.revokeObjectURL(audioPreview);
        }

        setAudioBlob(null);
        setAudioPreview("");
    } catch (error) {
        console.error("Voice message error:", error);
        alert(error.message || "Could not send voice message.");
    }
};
  useEffect(() => {
    socket.current = io("http://localhost:5000");
    socket.current.emit("addUser", user._id);

    socket.current.on("getMessage", ({ senderId, text }) => {
      if (currentChat && senderId === currentChat._id) {
        setMessages(prev => [...prev, { sender: senderId, text }]);
      }
    });

    socket.current.on("getUsers", (onlineIds) => {
      setOnlineUsers(onlineIds);
    });
  }, [user, currentChat]);

  useEffect(() => {
    fetch("http://localhost:5000/users")
      .then(res => res.json())
      .then(data => setUsers(data.filter(u => u._id !== user._id)));
  }, [user]);

  useEffect(() => {
    if (currentChat) {
      fetch(`http://localhost:5000/messages/${user._id}/${currentChat._id}`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [currentChat, user._id]);

  const sendMessage = async () => {
    if (!text) return;
    await fetch("http://localhost:5000/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: user._id, receiver: currentChat._id, text })
    });
    socket.current.emit("sendMessage", {
      senderId: user._id,
      receiverId: currentChat._id,
      text
    });
    setMessages(prev => [...prev, { sender: user._id, text }]);
    setText("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (showSettings) {
    return (
      <div>
        <button
          onClick={() => setShowSettings(false)}
          className="flex items-center gap-2 p-3 text-purple-600 font-semibold"
        >
          <ArrowLeft size={20} />
          Back to Chat
        </button>

        <Setting user={user} setUser={setUser} />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className={`bg-red-200 flex flex-col transition-transform duration-300
        ${showSidebar ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 w-64 md:w-1/4 absolute md:relative z-10 h-full`}>
        <div className="p-4 font-bold text-lg border-b flex justify-between">
          <div><h2>Users</h2></div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-red-300 transition cursor-pointer"
            title="Profile Settings"
            aria-label="Open profile settings"
          >
            <Settings size={22} />
          </button>
        </div>

        <div className="flex flex-col p-2">
          {users.map((u) => {
            const isOnline = onlineUsers.includes(u._id);

            return (
              <div
                key={u._id}
                onClick={() => {
                  setCurrentChat(u);
                  setShowSidebar(false);
                }}
                className="flex items-center gap-3 p-2 hover:bg-gray-200 rounded cursor-pointer"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={u.avatar}
                    alt={u.username}
                    className="w-12 h-12 rounded-full border-2 border-purple-600 object-cover"
                  />

                  <span
                    className={`absolute top-0 right-0 w-3 h-3 rounded-full border border-white ${
                      isOnline ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></span>
                </div>

                <span className="text-sm font-medium">{u.username}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-blue-300 w-full">
        {currentChat ? (
          <>
            <div className="p-4 font-bold text-lg border-b flex items-center justify-between">
              {currentChat.username}
              {onlineUsers.includes(currentChat._id) ? (
                <span className="text-green-500 text-sm">Online</span>
              ) : (
                <span className="text-gray-400 text-sm">Offline</span>
              )}
              <button onClick={() => setShowSidebar(true)} className="md:hidden ml-2 text-purple-600 font-bold">Back</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === user._id ? "justify-end" : "justify-start"}`}>
                  <div className={`${m.sender === user._id ? "bg-purple-600 text-white" : "bg-gray-300 text-black"} p-2 rounded-lg max-w-xs`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex p-4 border-t">
              <input value={text} onChange={e => setText(e.target.value)} className="flex-1 border p-2 rounded mr-2" placeholder="Type a message..." />
              <div className="voice-controls">
    {!isRecording ? (
        <button
            type="button"
            onClick={startRecording}
            title="Record voice message"
        >
            <Mic size={20} />
        </button>
    ) : (
        <button
            type="button"
            onClick={stopRecording}
            title="Stop recording"
        >
            <Square size={20} />
            Stop
        </button>
    )}

    {audioPreview && (
        <div>
            <audio controls src={audioPreview} />

            <button type="button" onClick={sendVoiceMessage}>
                <Send size={18} />
                Send voice
            </button>

            <button type="button" onClick={cancelRecording}>
                <Trash2 size={18} />
                Cancel
            </button>
        </div>
    )}
</div>
              <button onClick={sendMessage} className="bg-purple-600 text-white p-2 rounded">Send</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">Select a user to chat</div>
        )}
      </div>
    </div>
  );
};

export default Chat;
