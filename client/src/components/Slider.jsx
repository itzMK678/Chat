import React from 'react'
import Setting from "../components/Setting";
import {Settings} from "lucide-react";

const Slider = () => {
  return (
    <div>
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
    </div>
  )
}

export default Slider