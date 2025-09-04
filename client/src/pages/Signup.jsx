import { useState } from "react";

const Signup = ({ setUser }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");

  const handleSignup = async () => {
    if (!username || !email || !password) {
      alert("Fill all required fields");
      return;
    }

    const res = await fetch("http://localhost:5000/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, avatar: avatar || "" })
    });

    const data = await res.json();

    if (data.success) {
      setUser(data.user);
    } else {
      alert(data.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Signup</h2>
      <input
        className="border p-2 w-full mb-2 rounded"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2 rounded"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2 rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <input
        className="mb-2"
        type="file"
        onChange={e => {
          const reader = new FileReader();
          reader.onload = () => setAvatar(reader.result);
          reader.readAsDataURL(e.target.files[0]);
        }}
      />
      <button
        className="bg-purple-600 text-white p-2 rounded w-full"
        onClick={handleSignup}
      >
        Signup
      </button>
    </div>
  );
};

export default Signup;
