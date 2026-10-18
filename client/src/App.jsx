import { useState, useEffect } from "react";

import "./App.css";
import Start from "./components/Start";
function App() {
  const [user, setUser] = useState(null);
useEffect(() => {
  // Check if user already has a valid cookie session on initial load
  fetch(`${API_URL}/auth/me`, {
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setUser(data.user); // Kept logged in after F5!
      }
    })
    .catch(() => setUser(null));
}, []);
  return (
   <>
   <Start/>
   
   </>
  );
}

export default App;
