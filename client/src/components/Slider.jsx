
import React, { useEffect, useState } from "react";
import Setting from "../components/Setting";
import { Settings, ArrowLeft } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Slider = ({
  user,
  setUser,
  currentChat,
  setCurrentChat,
  onlineUsers = [],
}) => {
  const [users, setUsers] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch all users except the logged-in user
  useEffect(() => {
    if (!user?._id) return;

    fetch(`${API_URL}/users`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load users");
        return res.json();
      })
      .then((data) => {
        setUsers(data.filter((u) => u._id !== user._id));
      })
      .catch((error) => {
        console.error("Load users error:", error);
      });
  }, [user?._id]);

  // Show profile settings
  if (showSettings) {
    return (
      <div className="h-full">
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

  return (
    <aside
      className={`w-[350px] absolute inset-y-0 left-0 z-10 flex  flex-col bg-red-200 transition-transform duration-300 md:relative  md:translate-x-0 ${
        showSidebar ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Sidebar header */}
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

      {/* User list */}
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
              {/* Avatar and online status */}
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

              {/* Username and status */}
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
  );
};

export default Slider;
