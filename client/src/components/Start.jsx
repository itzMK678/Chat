
import { useState } from "react";
import Signup from "../pages/Signup";
import Login from "../pages/Login";
import Chat from "../pages/Chat";


function Start() {
  const [login, setLogin] = useState(true);
  const [user, setUser] = useState(null);

  return (
    <div className=" bg-gray-100">
      {!user ? (
        <div className="flex justify-center items-center">
          <div className=" p-10 rounded-lg shadow-lg w-96">

            {login ? (
              <>
                <Login setUser={setUser} />

                <p className="mt-4 text-center text-sm">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setLogin(false)}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </>
            ) : (
              <>
                <Signup setUser={setUser} />

                <p className="mt-4 text-center text-sm">
                  Already have an account?{" "}
                  <button
                    onClick={() => setLogin(true)}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Login
                  </button>
                </p>
              </>
            )}

          </div>
        </div>
      ) : (
        <Chat user={user} />
      )}
    </div>
  );
}

export default Start;
