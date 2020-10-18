import React, { useState } from "react";
import config from "./Config.js";
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

function getReceiverLink(id) {
  const currentURL = new URL(window.location.href);
  return `${currentURL.origin}/receive/${id}`
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

  const sender = async (e) => {
    e.preventDefault();

    const key = await genKey();
    const contents = await readFile(fileDetails);
    const encrypted = await encryptMessage(contents, key, password);

    // first, post metadata
    const validUntil = new Date(Date.now() + (config.FILE_VALID_HOURS*60*60*1000));
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const encodedKey = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
    const metadata = {
      fileName: fileDetails.name,
      contentLengthBytes: encrypted.byteLength,
      privateKey: encodedKey,
      validUntil: validUntil,
    }

    const transferDetails = await fetch(config.TRANSFER_API + "/transfer", {
      method: "POST",
      mode: "cors",  // TODO make this not CORS if possible
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }).then(resp => resp.json());

    const receiverLink = getReceiverLink(transferDetails.id);
    console.log(receiverLink);

    const socketUrl = new URL(config.COORD_API);
    socketUrl.searchParams.set("role", "offerer");
    socketUrl.searchParams.set("transfer_id", transferDetails.id);
    const socket = new WebSocket(socketUrl);
    socket.onmessage = function(event) {
      // TODO open a sender socket and do webrtc things
      console.log("received event", event)
    };

    // const sender = new Sender(encrypted);
    // const receiver = new Receiver(encrypted.byteLength);
    // sender.addIceCandidateListener(receiver);
    // receiver.addIceCandidateListener(sender);
    // const offer = await sender.createOffer();
    // const answer = await receiver.answer(offer);
    // await sender.registerAnswer(answer);

    // const received = await receiver.completionPromise;
    // const decrypted = await decryptMessage(received, key, password);

    // const downloadBlob = new Blob([decrypted], { type: "text/plain" });

    // // TODO change newfile
    // download("newfile.txt", downloadBlob);
  };

  const receiver = async (e) => {
    e.preventDefault();
    console.log("receiver button");
  }

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
          <button id="submit" type="submit" onClick={sender}>
            Submit
          </button>
        </div>
      </form>
      <button id="receiver" type="submit" onClick={receiver}>
        Simulate receiver
      </button>
      {fileDetails && <div>Filename: {fileDetails.name}</div>}
    </div>
  );
}

export default App;
