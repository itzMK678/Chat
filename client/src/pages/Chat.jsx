
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import Setting from "../components/Setting";
import { Settings, ArrowLeft } from "lucide-react";

const Chat = ({ user, setUser }) => {
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);

  const socket = useRef();

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
