import { useState } from "react";
import Signup from "../pages/Signup";
import Login from "../pages/Login";
import Chat from "../pages/Chat";

function Start({ user, setUser }) {
  const [login, setLogin] = useState(true);

  if (user) {
    return <Chat user={user} setUser={setUser} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        {login ? (
          <>
            <Login setUser={setUser} />
            <p className="mt-4 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setLogin(false)}
                className="font-semibold text-purple-600 hover:underline"
              >
                Sign up
              </button>
            </p>
          </>
        ) : (
          <>
            <Signup setUser={setUser} switchToLogin={() => setLogin(true)} />
            <p className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setLogin(true)}
                className="font-semibold text-purple-600 hover:underline"
              >
                Login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Start;
