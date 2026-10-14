import { useState } from "react";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import "./App.css";
function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100">
      {!user ? (
        <div className="flex justify-center items-center h-screen">
          <div className="bg-white p-10 rounded-lg shadow-lg w-96">
           <div>
             <Signup setUser={setUser} />
               </div>
            <div>
            <Login setUser={setUser} />
            </div>
          </div>
        </div>
      ) : (
        <Chat user={user} />
      )}
      
       
    </div>
  );
}

export default App;
