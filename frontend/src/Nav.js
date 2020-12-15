import React from "react";
import "./Nav.css";

function Nav() {
  return (
    <div className="nav">
      <a href="/">Home</a>
      <span className="divider">|</span>
      <a href="/">Transfer Files</a>
      <span className="divider">|</span>
      <a href="/about">About</a>
      <span className="divider">|</span>
      <a
        href="https://github.com/jchorl/sendfiles"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source
      </a>
    </div>
  );
}

export default Nav;
