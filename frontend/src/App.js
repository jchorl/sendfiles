import React, { useState } from "react";
import { genKey, encryptMessage, decryptMessage } from "./Crypto.js";
import { readFile } from "./File.js";
import { Sender, Receiver } from "./FileTransfer.js";
import "./App.css";

function download(filename, blob) {
  const downloadLink = URL.createObjectURL(blob);

  const element = document.createElement("a");
  element.setAttribute("href", downloadLink);
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function testws() {
  let socket = new WebSocket("wss://5xw0qooyve.execute-api.us-west-2.amazonaws.com/prod");

  socket.onopen = function(e) {
    console.log("[open] Connection established");
    console.log("Sending to server");
    // socket.send("My name is John");
  };

  socket.onmessage = function(event) {
    console.log(`[message] Data received from server: ${event.data}`);
  };

  socket.onclose = function(event) {
    if (event.wasClean) {
      console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
      // e.g. server process killed or network down
      // event.code is usually 1006 in this case
      console.log('[close] Connection died');
    }
  };

  socket.onerror = function(error) {
    console.log(`[error] ${error.message}`);
  };
}

function App() {
  const [password, setPassword] = useState("");
  const [fileDetails, setFileDetails] = useState();

  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log("No file chosen");
      return;
    }

    setFileDetails(file);
  };

  const submit = async (e) => {
    e.preventDefault();

    const key = await genKey();
    const contents = await readFile(fileDetails);
    const encrypted = await encryptMessage(contents, key, password);

    const sender = new Sender(encrypted);
    const receiver = new Receiver(encrypted.byteLength);
    sender.addIceCandidateListener(receiver);
    receiver.addIceCandidateListener(sender);
    const offer = await sender.createOffer();
    const answer = await receiver.answer(offer);
    await sender.registerAnswer(answer);

    const received = await receiver.completionPromise;
    const decrypted = await decryptMessage(received, key, password);

    const downloadBlob = new Blob([decrypted], { type: "text/plain" });

    // TODO change newfile
    download("newfile.txt", downloadBlob);
  };

  return (
    <div>
      <header>Secure Send</header>
      <form>
        <div>
          <label htmlFor="password" className="file-select-label">
            Enter password
          </label>
          <input
            id="password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </div>
        <div>
          <label htmlFor="file_input" className="file-select-label">
            Select a file to transfer
          </label>
          <input id="file_input" type="file" onChange={onFileSelected} />
        </div>
        <div>
          <button id="submit" type="submit" onClick={submit}>
            Submit
          </button>
        </div>
      </form>
      <button id="testingbutton" type="submit" onClick={testws}>
        Test Websocket
      </button>
      {fileDetails && <div>Filename: {fileDetails.name}</div>}
    </div>
  );
}

export default App;
