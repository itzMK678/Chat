import { useState } from "react";

import "./App.css";
import Start from "./components/Start";
function App() {
  const [user, setUser] = useState(null);

  return (
   <>
   <Start/>
   
   </>
  );
}

export default App;
