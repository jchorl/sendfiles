import React from "react";
import SendApp from "./SendApp";
import ReceiveApp from "./ReceiveApp";
import "./App.css";

function App() {
  const url = new URL(window.location.href);

  return (
    <div>
      <header>Secure Send</header>
      {url.pathname.startsWith("/receive") ? <ReceiveApp /> : <SendApp />}
    </div>
  );
}

export default App;
