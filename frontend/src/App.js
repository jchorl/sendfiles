import React from "react";
import AboutApp from "./AboutApp";
import SendApp from "./SendApp";
import ReceiveApp from "./ReceiveApp";
import Nav from "./Nav";
import "./App.css";

function App() {
  const url = new URL(window.location.href);

  let component;

  if (url.pathname.startsWith("/about")) {
    component = <AboutApp />;
  } else if (url.pathname.startsWith("/receive")) {
    component = <ReceiveApp />;
  } else {
    component = <SendApp />;
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>sendfiles.dev</h1>
          <span className="tagline">
            Encrypted, browser-to-browser file transfer.
          </span>
        </div>
        <Nav />
      </div>
      {component}
    </div>
  );
}

export default App;
